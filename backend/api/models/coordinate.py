'''
Author: MondayCha
Date: 2022-04-06 17:12:13
Description: 
'''
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
        return "<lon: %s, lat: %s>" % (self.longitude, self.latitude)

    def to_dict(self):
        return {
            'longitude': float(self.longitude),
            'latitude': float(self.latitude)
        }

class TimestampCoordinate(Coordinate):
    def __init__(self, longitude: str, latitude: str, timestamp: str):
        super().__init__(longitude, latitude)
        self.timestamp: str = timestamp

    def __lt__(self, other):
        if type(other) != type(self):
            return False
        return self.timestamp < other.timestamp if self.timestamp != other.timestamp else super().__lt__(other)

    def __eq__(self, other):
        if type(other) != type(self):
            return False
        return self.timestamp == other.timestamp and super().__eq__(other)

    def __hash__(self):
        return hash((self.timestamp, super().__hash__()))

    def __str__(self):
        return "%s %s %s" % (self.longitude, self.latitude, self.timestamp)

    def __repr__(self):
        return "<lon: %s, lat: %s, time: %s>" % (self.longitude, self.latitude, self.timestamp)

    def to_dict(self):
        return {
            'longitude': float(self.longitude),
            'latitude': float(self.latitude),
            'timestamp': self.timestamp
        }