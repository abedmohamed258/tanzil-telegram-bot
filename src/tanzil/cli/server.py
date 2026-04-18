import asyncio
import json
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
        data = await reader.readline()
        if not data:
            return

        try:
            request = json.loads(data.decode().strip())
            command = request.get("command")
            response = {"status": "error", "message": "Unknown command"}

            if command == "submit":
                payload = request.get("payload", {})
                task_id = await self.engine.submit_task(payload)
                response = {"status": "PENDING", "task_id": str(task_id)}

            elif command == "status":
                task_id = request.get("task_id")
                try:
                    task = await self.engine.get_task_status(task_id)
                    response = {"status": task.status.value, "task_id": str(task.id)}
                except KeyError:
                    response = {"status": "error", "message": "Task not found"}

            elif command == "list":
                tasks_dict = self.engine.list_tasks()
                response = {str(t_id): t.status.value for t_id, t in tasks_dict.items()}

            elif command == "cancel":
                task_id = request.get("task_id")
                success = await self.engine.cancel_task(task_id)
                response = {"status": "ok" if success else "error"}

            writer.write((json.dumps(response) + "\n").encode())
            await writer.drain()
        except Exception as e:
            logger.error("Error handling client: %s", e)
        finally:
            writer.close()
            await writer.wait_closed()

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
