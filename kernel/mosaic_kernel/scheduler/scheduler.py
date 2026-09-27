"""Task scheduler: priority queues + admission control. Starts each task's root agent (the planner)."""
from __future__ import annotations

import asyncio
import itertools
import logging
from typing import TYPE_CHECKING

from mosaic_contracts.errors import MosaicError
from mosaic_contracts.schema import ErrorInfo, Priority, SpawnRequest, Task, TaskStatus

if TYPE_CHECKING:
    from ..kernel import Kernel

log = logging.getLogger("mosaic.kernel.scheduler")

PRIORITY_RANK = {Priority.HIGH: 0, Priority.NORMAL: 1, Priority.BACKGROUND: 2}
ROOT_AGENT = "planner-agent"


class Scheduler:
    def __init__(self, kernel: Kernel, max_concurrent_tasks: int = 2, gpu_memory_limit: float = 0.95) -> None:
        self.k = kernel
        self.max_concurrent_tasks = max_concurrent_tasks
        self.gpu_memory_limit = gpu_memory_limit
        self.running: set[str] = set()
        self._seq = itertools.count()
        self._queue: asyncio.PriorityQueue | None = None
        self._freed: asyncio.Event | None = None
        self._loop_task: asyncio.Task | None = None
        self._pending: list[Task] = []  # enqueued before start()

    async def start(self) -> None:
        self._queue, self._freed = asyncio.PriorityQueue(), asyncio.Event()
        for t in self._pending:
            await self.enqueue(t)
        self._pending.clear()
        self._loop_task = asyncio.create_task(self._loop(), name="mosaic-scheduler")

    async def stop(self) -> None:
        if self._loop_task:
            self._loop_task.cancel()
            await asyncio.gather(self._loop_task, return_exceptions=True)

    async def enqueue(self, task: Task) -> None:
        if self._queue is None:
            self._pending.append(task)
            return
        await self._queue.put((PRIORITY_RANK[task.priority], next(self._seq), task.task_id))

    def release(self, task_id: str) -> None:
        self.running.discard(task_id)
        if self._freed is not None:
            self._freed.set()

    async def _admit(self) -> None:
        while len(self.running) >= self.max_concurrent_tasks or not await self._gpu_ok():
            self._freed.clear()
            try:
                await asyncio.wait_for(self._freed.wait(), timeout=1.0)
            except TimeoutError:
                pass

    async def _gpu_ok(self) -> bool:
        probe = self.k.services.probe
        if probe is None:
            return True
        try:
            gpu = (await probe.snapshot()).gpu
        except Exception:
            return True
        return gpu is None or gpu.memory_total_mb == 0 or gpu.memory_used_mb / gpu.memory_total_mb < self.gpu_memory_limit

    async def _loop(self) -> None:
        while True:
            _, _, task_id = await self._queue.get()
            task = self.k.tasks.find(task_id)
            if task is None or task.status != TaskStatus.QUEUED:
                continue  # cancelled while queued
            await self._admit()
            self.running.add(task_id)
            root = task.metadata.get("root_agent", ROOT_AGENT)
            try:
                await self.k.lifecycle.spawn(SpawnRequest(agent=root, goal=task.goal, task_id=task_id))
            except MosaicError as e:
                await self.k.tasks.fail(task_id, f"could not start {root}: {e.message}", e.to_info())
            except Exception as e:  # never let one bad task kill the scheduler
                log.exception("starting task %s failed", task_id)
                await self.k.tasks.fail(task_id, str(e), ErrorInfo(code="INTERNAL", message=str(e)))
