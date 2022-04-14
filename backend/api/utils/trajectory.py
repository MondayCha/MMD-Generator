def getBounds(trajs):
    left: float = 180
    right: float =  -180 
    bottom: float = 90
    top: float =  -90
    for traj in trajs:
        for coordinate in traj:
            if float(coordinate.longitude) < left:
                left = float(coordinate.longitude)
            if float(coordinate.longitude) > right:
                right = float(coordinate.longitude)
            if float(coordinate.latitude) < bottom:
                bottom = float(coordinate.latitude)
            if float(coordinate.latitude) > top:
                top = float(coordinate.latitude)

    return left, right, bottom, top