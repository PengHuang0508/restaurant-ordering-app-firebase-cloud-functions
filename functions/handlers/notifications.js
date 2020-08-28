const { db } = require('../utils/admin');

exports.getAnnouncement = (req, res) => {
  db.collection('announcements')
    .get()
    .then((doc) => {
      let announcements = {};
      doc.forEach((ann) => {
        announcements[ann.id] = ann.data();
      });
      return res.json(announcements);
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};

exports.postAnnouncement = (req, res) => {
  let announcement = {
    sender: req.user.handle,
    content: req.body.content,
    createdAt: new Date().toDateString(),
  };

  db.collection('announcements')
    .add(announcement)
    .then((docRef) => {
      let announcementId = docRef.id;
      return db
        .doc(`/announcements/${announcementId}`)
        .update({ announcementId });
    })
    .then(() => {
      return res.json({ message: 'Announcement posted successfully' });
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};

exports.updateAnnouncement = (req, res) => {
  let annDetails = req.body;
  annDetails.createdAt = new Date().toDateString();
  let annRef = db.doc(`/announcements/${req.params.annId}`);

  annRef
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({ error: 'Announcement not found' });
      }
      return annRef.update(annDetails);
    })
    .then(() => {
      return res.json({ message: 'Announcement updated successfully' });
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};

exports.deleteAnnouncement = (req, res) => {
  let annRef = db.doc(`/announcements/${req.params.annId}`);

  annRef
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({ error: 'Announcement not found' });
      }
      return annRef.delete();
    })
    .then(() => {
      return res.json({ message: 'Announcement deleted successfully' });
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};
