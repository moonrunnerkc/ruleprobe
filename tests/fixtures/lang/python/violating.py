"""Fixture: deliberately violates Python naming and length conventions."""


def BadlyNamed(value):
    """This function uses CamelCase which Python convention forbids."""
    return value * 2


class lowercase_class:
    """This class uses snake_case which Python convention forbids for classes."""

    def __init__(self, value):
        self.value = value


def long_function_for_test():
    """A function whose body is intentionally long to trigger the length check."""
    a = 1
    b = 2
    c = 3
    d = 4
    e = 5
    f = 6
    g = 7
    h = 8
    i = 9
    j = 10
    k = 11
    l = 12
    m = 13
    n = 14
    o = 15
    p = 16
    q = 17
    r = 18
    s = 19
    t = 20
    return a + b + c + d + e + f + g + h + i + j + k + l + m + n + o + p + q + r + s + t
