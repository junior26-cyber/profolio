from jinja2 import Environment


def environment(**options):
    env = Environment(**options)
    env.globals.update({
        "len": len,
    })
    return env
