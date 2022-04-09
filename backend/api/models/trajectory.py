from api.models.coordinate import Coordinate


class SubTrajectory:
    def __init__(self, trajectory_id):
        self.id = trajectory_id
        self.trajectory: list[Coordinate] = []
        self.begin_index = -1
        self.end_index = -1

    def append(self, coordinate, index):
        self.trajectory.append(coordinate)
        if self.begin_index == -1:
            self.begin_index = index
        self.end_index = index

    def __repr__(self):
        return "< id: %s start: %s end: %s traj: %s >" % (self.id, self.begin_index, self.end_index, self.trajectory)
    
    def to_dict(self):
        return {
            'id': self.id,
            # 'begin_index': self.begin_index,
            # 'end_index': self.end_index,
            'trajectory': [coordinate.to_dict() for coordinate in self.trajectory]
        }

class MatchingMethod:
    def __init__(self, name: str, path: str):
        self.name: str = name
        self.path: str = path
        self.unmatched_trajs: list[SubTrajectory] = []
    
    def __str__(self):
            return "< name: %s >" % (self.name)

    def __repr__(self):
        return "< name: %s >" % (self.name)

    def to_dict(self):
        return {
            'name': self.name,
            'unmatched_trajs': [failed_traj.to_dict() for failed_traj in self.unmatched_trajs]
        }


class Trajectory:
    def __init__(self, name: str, path: str):
        self.name: str = name
        self.path: str = path
        self.success: bool = False
        self.matching_method_dict: dict[str, MatchingMethod] = {}
        self.common_trajs: list[SubTrajectory] = []

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

    def to_dict(self):
        left: float = 180
        right: float =  -180 
        bottom: float = 90
        top: float =  -90
        for common_traj in self.common_trajs:
            for coordinate in common_traj.trajectory:
                if float(coordinate.longitude) < left:
                    left = float(coordinate.longitude)
                if float(coordinate.longitude) > right:
                    right = float(coordinate.longitude)
                if float(coordinate.latitude) < bottom:
                    bottom = float(coordinate.latitude)
                if float(coordinate.latitude) > top:
                    top = float(coordinate.latitude)
        return {
            "name": self.name,
            "success": self.success,
            "bounds": {
                "left_top": {
                    "longitude": left,
                    "latitude": top
                },
                "right_bottom": {
                    "longitude": right,
                    "latitude": bottom
                }
            },
            "matching_methods": [matching_method.to_dict() for matching_method in self.matching_method_dict.values()],
            "common_trajs": [success_traj.to_dict() for success_traj in self.common_trajs]
        }
