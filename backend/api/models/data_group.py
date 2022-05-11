from app import db, hashids
from sqlalchemy.ext.hybrid import hybrid_property
from datetime import datetime
from api.models.user import User

"""
Map-Matching Dataset Model
- Each Dataset is a collection of datas.
- Datas in the same dataset share the same road network.
"""
class DataGroup(db.Model):
    __tablename__ = "data_group"

    id = db.Column(db.Integer, primary_key=True)
    created = db.Column(db.DateTime, nullable=False, default=datetime.now)
    updated = db.Column(db.DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)
    osm_path = db.Column(db.String, nullable=False)
    datas = db.relationship('Data', backref='group', lazy="dynamic", cascade='all, delete-orphan', passive_deletes=True)

    @hybrid_property
    def hashid(self):
        return hashids.encode(self.id)

    def __repr__(self):
        return '<DataGroup {} {}>'.format(self.id, hashids.encode(self.id))