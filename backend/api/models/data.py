from app import db
from datetime import datetime


class Data(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    updated = db.Column(db.DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)

    group_id = db.Column(db.Integer, db.ForeignKey('data_group.id', ondelete='CASCADE'), nullable=False)
    annotator_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)

    def __repr__(self):
        return '<Data {}>'.format(self.id)