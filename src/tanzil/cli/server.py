import asyncio
import logging
import os

from tanzil.core.engine import Engine

logger = logging.getLogger("tanzil.server")
HOST = os.getenv("TANZIL_HOST", "0.0.0.0")
PORT = int(os.getenv("TANZIL_PORT", "8000"))


class TanzilServer:
    def __init__(self, config_path: str):
        self.engine = Engine(config_path)
        self.host = HOST
        self.port = PORT

    async def handle_client(
        self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter
    ):
        # ... (same logic as before)
        pass

    async def run(self):
        await self.engine.initialize()
        server = await asyncio.start_server(
            self.handle_client, host=self.host, port=self.port
        )

        logger.info("Server started on %s:%s", self.host, self.port)
        async with server:
            try:
                await server.serve_forever()
            except asyncio.CancelledError:
                pass
            finally:
                await self.engine.stop()


def run_server(config: str):
    logging.basicConfig(level=logging.INFO)
    server = TanzilServer(config)
    try:
        asyncio.run(server.run())
    except KeyboardInterrupt:
        pass
