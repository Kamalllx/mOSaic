"""In-process event bus with bounded per-subscriber queues (Redis Streams mirroring is a stretch goal)."""
from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from fnmatch import fnmatch

from mosaic_contracts.schema import Event

log = logging.getLogger("mosaic.kernel.events")

Handler = Callable[[Event], Awaitable[None]]


class _Subscription:
    def __init__(self, cancel: Callable[[], None]) -> None:
        self._cancel = cancel

    def unsubscribe(self) -> None:
        self._cancel()


class EventStream:
    """Registered on creation, so nothing published after `stream()` returns is lost. Call close() when done."""

    def __init__(self, bus: KernelEventBus, pattern: str, task_id: str | None, maxsize: int) -> None:
        self._bus = bus
        self.pattern, self.task_id = pattern, task_id
        self.queue: asyncio.Queue[Event] = asyncio.Queue(maxsize=maxsize)
        bus._streams.append(self)

    def matches(self, event: Event) -> bool:
        return fnmatch(event.type, self.pattern) and (self.task_id is None or event.task_id == self.task_id)

    def offer(self, event: Event) -> None:
        if self.queue.full():  # slow consumer (e.g. a stalled WebSocket): drop the oldest, keep the newest
            self.queue.get_nowait()
        self.queue.put_nowait(event)

    def __aiter__(self) -> EventStream:
        return self

    async def __anext__(self) -> Event:
        return await self.queue.get()

    def close(self) -> None:
        if self in self._bus._streams:
            self._bus._streams.remove(self)


class KernelEventBus:
    def __init__(self, stream_maxsize: int = 1000) -> None:
        self._subs: list[tuple[str, Handler]] = []
        self._streams: list[EventStream] = []
        self._maxsize = stream_maxsize

    async def publish(self, event: Event) -> None:
        for pattern, handler in list(self._subs):
            if fnmatch(event.type, pattern):
                try:
                    await handler(event)
                except Exception:  # a broken subscriber must never break the publisher
                    log.exception("event handler failed for %s", event.type)
        for stream in list(self._streams):
            if stream.matches(event):
                stream.offer(event)

    def subscribe(self, pattern: str, handler: Handler) -> _Subscription:
        entry = (pattern, handler)
        self._subs.append(entry)
        return _Subscription(lambda: entry in self._subs and self._subs.remove(entry))

    def stream(self, pattern: str = "*", task_id: str | None = None) -> AsyncIterator[Event]:
        return EventStream(self, pattern, task_id, self._maxsize)
