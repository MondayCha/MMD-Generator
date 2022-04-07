class Coordinate:
    def __init__(self, longitude: str, latitude: str):
        self.longitude: str = longitude
        self.latitude: str = latitude

    def __lt__(self, other):
        if type(other) != type(self):
            return False
        return self.longitude < other.longitude if self.longitude != other.longitude else self.latitude < other.latitude

    def __eq__(self, other):
        if type(other) != type(self):
            return False
        return self.longitude == other.longitude and self.latitude == other.latitude

    def __hash__(self):
        return hash((self.longitude, self.latitude))

    def __str__(self):
        return "%s %s" % (self.longitude, self.latitude)

    def __repr__(self):
        return "< longitude: %s, latitude: %s >" % (self.longitude, self.latitude)