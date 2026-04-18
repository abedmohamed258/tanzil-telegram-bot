import yaml

from tanzil.clients.telegram.config import load_config


def test_telegram_config_profile_loading(tmp_path):
    config_path = tmp_path / "config.yaml"
    config_path.write_text(
        yaml.dump(
            {
                "telegram": {
                    "token": "123:token",
                    "authorized_users": [1001],
                    "task_db_path": str(tmp_path / "tasks.db"),
                }
            }
        )
    )

    loaded_config = load_config(str(config_path))

    assert loaded_config.telegram.authorized_users == [1001]
    assert loaded_config.telegram.task_db_path.endswith("tasks.db")


def test_telegram_config_defaults(tmp_path):
    config_path = tmp_path / "config.yaml"
    config_path.write_text(
        yaml.dump(
            {
                "telegram": {
                    "token": "123:token",
                    "authorized_users": [],
                }
            }
        )
    )

    loaded_config = load_config(str(config_path))

    assert loaded_config.telegram.core_socket_path == "/tmp/tanzil.sock"
    assert loaded_config.telegram.status_poll_interval_sec == 0.2
