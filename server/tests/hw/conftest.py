"""
Hardware-in-the-loop test gate.

These tests require two physical RYLR998 modules. Skip them unless the
operator explicitly opts in via the WAVE_HW_BENCH environment variable.

Configure the two serial ports via WAVE_HW_SERVER_PORT and WAVE_HW_ROUTER_PORT
(or default to /dev/ttyUSB0 and /dev/ttyAMA0).
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

# The `pi/` package lives at the repo root, one level above pytest's rootdir
# (`server/`). Put the repo root on sys.path so the relay-backed H14 test can
# `import pi.router.relay` while `wave_api` still resolves from `server/`.
_REPO_ROOT = Path(__file__).resolve().parents[3]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))


def _hw_enabled() -> bool:
    return os.environ.get("WAVE_HW_BENCH", "0") == "1"


def pytest_collection_modifyitems(config, items):
    if _hw_enabled():
        return
    skip_marker = pytest.mark.skip(reason="set WAVE_HW_BENCH=1 to run RYLR998 bench tests")
    for item in items:
        # Only skip items physically located under tests/hw/.
        path_str = str(item.fspath).replace("\\", "/")
        if "/tests/hw/" in path_str:
            item.add_marker(skip_marker)


@pytest.fixture(scope="session")
def server_port() -> str:
    return os.environ.get("WAVE_HW_SERVER_PORT", "/dev/ttyUSB0")


@pytest.fixture(scope="session")
def router_port() -> str:
    return os.environ.get("WAVE_HW_ROUTER_PORT", "/dev/ttyAMA0")


@pytest.fixture()
def server_driver(server_port):
    pytest.importorskip("serial")
    import serial

    from wave_api.lora.rylr998 import Rylr998Driver

    ser = serial.Serial(server_port, baudrate=115200, timeout=0.2)
    drv = Rylr998Driver(ser)
    drv.configure(address=1, network_id=18)
    yield drv
    drv.close()


@pytest.fixture()
def router_driver(router_port):
    pytest.importorskip("serial")
    import serial

    from wave_api.lora.rylr998 import Rylr998Driver

    ser = serial.Serial(router_port, baudrate=115200, timeout=0.2)
    drv = Rylr998Driver(ser)
    drv.configure(address=2, network_id=18)
    yield drv
    drv.close()
