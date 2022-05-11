from app import db
from datetime import datetime


class Method(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    mismatched_area_count = db.Column(db.Integer, nullable=False, default=0)
    mismatched_point_count = db.Column(db.Integer, nullable=False, default=0)
    total_point_count = db.Column(db.Integer, nullable=False, default=0)

    def __repr__(self):
        return '<Method {}>'.format(self.name)