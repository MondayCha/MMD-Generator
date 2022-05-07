from app import db
from datetime import datetime


class Data(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    status = db.Column(db.Integer, nullable=False) # 0: failed, 1: processed, 2: annotated 3: checked
    updated = db.Column(db.DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)
    path = db.Column(db.String(255), nullable=False)
    group_id = db.Column(db.Integer, db.ForeignKey('data_group.id', ondelete='CASCADE'), nullable=False)
    annotations = db.relationship('Annotation', backref='data', lazy="dynamic", cascade='all, delete-orphan', passive_deletes=True)

    def __repr__(self):
        return '<Data {}>'.format(self.id)