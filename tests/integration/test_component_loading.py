import asyncio
import json

import pytest
import yaml

from tanzil.cli.server import TanzilServer


class _MemoryWriter:
    def __init__(self):
        self.buffer = b""

    def write(self, data: bytes):
        self.buffer += data

    async def drain(self):
        return None

    def close(self):
        return None

    async def wait_closed(self):
        return None


@pytest.mark.asyncio
async def test_server_handles_submit_status_and_list(tmp_path):
    config_file = tmp_path / "config.yaml"
    config_file.write_text(yaml.dump({"max_concurrency": 1}))

    server = TanzilServer(str(config_file))
    await server.engine.initialize()

    reader = asyncio.StreamReader()
    reader.feed_data(
        json.dumps(
            {"command": "submit", "payload": {"url": "https://example.com"}}
        ).encode()
        + b"\n"
    )
    reader.feed_eof()
    writer = _MemoryWriter()
    await server.handle_client(reader, writer)
    submit_response = json.loads(writer.buffer.decode())

    await asyncio.sleep(0.3)

    status_reader = asyncio.StreamReader()
    status_reader.feed_data(
        json.dumps(
            {"command": "status", "task_id": submit_response["task_id"]}
        ).encode()
        + b"\n"
    )
    status_reader.feed_eof()
    status_writer = _MemoryWriter()
    await server.handle_client(status_reader, status_writer)
    status_response = json.loads(status_writer.buffer.decode())

    list_reader = asyncio.StreamReader()
    list_reader.feed_data(json.dumps({"command": "list"}).encode() + b"\n")
    list_reader.feed_eof()
    list_writer = _MemoryWriter()
    await server.handle_client(list_reader, list_writer)
    list_response = json.loads(list_writer.buffer.decode())

    assert submit_response["status"] == "PENDING"
    assert status_response["status"] == "COMPLETED"
    assert submit_response["task_id"] in list_response

    await server.engine.stop()
