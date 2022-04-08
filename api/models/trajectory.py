from ast import Str


class Trajectory:
    def __init__(self, name: str, path: str, success: bool = False):
        self.name: str = name
        self.path: str = path
        self.success: bool = False
        self.matching_methods: list = []

    def __eq__(self, other):
        if type(other) != type(self):
            return False
        return self.name == other.name

    def __hash__(self):
        return hash((self.name))

    def __str__(self):
        return "< name: %s success: %s >" % (self.name, self.success)

    def __repr__(self):
        return "< name: %s success: %s >" % (self.name, self.success)