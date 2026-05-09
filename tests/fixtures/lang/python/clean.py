"""Fixture: follows Python naming and length conventions."""


def well_named(value):
    """Snake-case function name with a short body."""
    return value * 2


class ProperClass:
    """PascalCase class with a short __init__."""

    def __init__(self, value):
        self.value = value
