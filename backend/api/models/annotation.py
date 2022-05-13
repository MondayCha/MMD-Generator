from app import db, hashids
from datetime import datetime
from sqlalchemy.ext.hybrid import hybrid_property


class Annotation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    updated = db.Column(db.DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)
    path = db.Column(db.String(255), nullable=False)
    comment = db.Column(db.String, nullable=True)

    data_id = db.Column(db.Integer, db.ForeignKey('data.id', ondelete='CASCADE'), nullable=False)
    annotator_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)

    status = db.Column(db.Integer, nullable=False, default=-1) # -1: unreviewd, 0: failed 1: selected
    review_comment = db.Column(db.String, nullable=True)

    @hybrid_property
    def hashid(self):
        return hashids.encode(self.id)

    def __repr__(self):
        return '<Annotation {}>'.format(self.id)

    def to_dict(self):
        return {
            'hashid': self.hashid,
            'data_name': self.data.name,
            'annotator_name': self.annotator.username,
            'group_hashid': self.data.group.hashid,
            'status': self.status,
        }