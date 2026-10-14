"""Compatibility entry point; generic builder defaults to Nova."""
import runpy
from pathlib import Path
runpy.run_path(str(Path(__file__).with_name("build-hero.py")),run_name="__main__")
