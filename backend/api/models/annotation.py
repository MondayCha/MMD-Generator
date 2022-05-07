from app import db
from datetime import datetime


class Annotation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    updated = db.Column(db.DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)
    path = db.Column(db.String(255), nullable=False)
    comment = db.Column(db.String, nullable=True)

    data_id = db.Column(db.Integer, db.ForeignKey('data.id', ondelete='CASCADE'), nullable=False)
    annotator_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)

    selected = db.Column(db.Boolean, nullable=False, default=False)

    def __repr__(self):
        return '<Annotation {}>'.format(self.id)