const { admin, db } = require('../utils/admin');
const firebaseConfig = require('../utils/firebaseConfig');
const {
  validateItemChanges,
  validateItemListData,
  validateCategoryData,
} = require('../utils/validators');

const FieldValue = admin.firestore.FieldValue;

exports.getActiveMenu = (req, res) => {
  db.collection('menu')
    .where('settings', '>=', { active: true })
    .get()
    .then((doc) => {
      let menu = [];

      doc.forEach((category) => {
        let { settings, ...items } = category.data();
        let itemList = [];

        for (item in items) {
          if (items[item].active) itemList.push(items[item]);
        }
        // sort itemList alphabetically
        itemList.sort((a, b) => {
          const nameA = a.name.toLowerCase();
          const nameB = b.name.toLowerCase();
          return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
        });
        // exclude non-active items
        if (Array.isArray(itemList) && itemList.length) {
          menu.push(Object.assign({ itemList }, { settings }));
        }
      });

      return res.json(menu);
    })
    .catch((err) => console.error(err));
};

exports.getAllMenu = (req, res) => {
  db.collection('menu')
    .get()
    .then((doc) => {
      let menu = [];

      doc.forEach((category) => {
        const categoryId = category.id;
        let { settings, ...items } = category.data();
        let itemList = [];

        for (item in items) {
          itemList.push(items[item]);
        }
        // sort itemList alphabetically
        itemList.sort((a, b) => {
          const nameA = a.name.toLowerCase();
          const nameB = b.name.toLowerCase();
          return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
        });
        menu.push(Object.assign({ categoryId }, { itemList }, { settings }));
      });

      return res.json(menu);
    })
    .catch((err) => console.error(err));
};

exports.getItem = (req, res) => {
  const itemId = req.params.itemId;
  let itemData = {};

  db.doc(`/menuItems/${itemId}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({ error: 'Item not found' });
      }

      itemData = doc.data();
      itemData.itemId = doc.id;

      return res.json(itemData);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

exports.getAllItems = (req, res) => {
  let itemsData = [];

  db.collectionGroup(`menuItems`)
    .get()
    .then((doc) => {
      if (doc.size <= 0) {
        return res.status(400).json({
          error: 'No items found. Please create an item first.',
        });
      }
      doc.forEach((item) => {
        itemsData.push({
          active: item.data().active,
          categories: item.data().categories,
          createdAt: item.data().createdAt,
          description: item.data().description,
          itemId: item.data().itemId,
          name: item.data().name,
          price: item.data().price,
          thumbnailUrl: item.data().thumbnailUrl,
        });
      });

      return res.json(itemsData);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

exports.createMenuItem = (req, res) => {
  const itemDetails = {
    name: req.body.name,
    description: req.body.description,
    price: Number(req.body.price),
    thumbnailUrl: `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/default.jpg?alt=media`,
    active: req.body.active,
    createdAt: new Date().toISOString(),
  };

  db.collection('menuItems')
    .where('name', '==', itemDetails.name)
    .get()
    .then((doc) => {
      if (doc.size > 0) {
        return res.status(400).json({
          error:
            'Item with the same name already exists. Please rename your item or edit the existing one.',
        });
      }
      return db
        .collection('menuItems')
        .add(itemDetails)
        .then((docRef) => {
          const itemId = docRef.id;

          return db
            .doc(`/menuItems/${itemId}`)
            .update({ itemId })
            .then(() => {
              if (itemDetails.active) {
                return res.json({
                  itemId,
                  message: `${itemDetails.name} created successfully and set to active.`,
                });
              } else {
                return res.json({
                  itemId,
                  message: `${itemDetails.name} created successfully. However, it won't appear on the menu until it's set to active.`,
                });
              }
            });
        });
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: 'Something went wrong' });
    });
};

exports.updateItemDetails = (req, res) => {
  const itemDetails = req.body;
  const { valid, toBeUpdatedPreviewFields, errors } = validateItemChanges(
    itemDetails
  );

  if (!valid) return res.status(400).json(errors);

  const itemId = req.params.itemId;
  const itemRef = db.doc(`/menuItems/${itemId}`);

  db.runTransaction((t) => {
    return t
      .get(itemRef)
      .then((doc) => {
        if (!doc.exists) {
          return res.status(404).json({ error: 'Item not found' });
        }
        t.update(itemRef, itemDetails);

        const itemCategoryList = doc.data().categories;

        if (!Array.isArray(itemCategoryList) || !itemCategoryList.length) {
          return res.json({
            message: `Item ${itemId} updated successfully.`,
          });
        }

        return db
          .collection('menu')
          .where(`${itemId}.itemId`, '==', itemId)
          .get()
          .then((categoryQuery) => {
            categoryQuery.forEach((category) => {
              const categoryRef = db.doc(`/menu/${category.id}`);
              const previewFields = Object.assign(
                category.data()[itemId],
                toBeUpdatedPreviewFields
              );

              t.update(categoryRef, {
                [itemId]: previewFields,
              });
            });

            return null;
          })
          .then(() => {
            return res.json({
              message: `Item ${itemId} updated successfully.`,
            });
          });
      })
      .catch((err) => {
        console.error(err);
        return res.status(500).json({ error: 'Something went wrong' });
      });
  });
};

exports.uploadImage = (req, res) => {
  const itemId = req.params.itemId;
  const itemRef = db.doc(`/menuItems/${itemId}`);
  const BusBoy = require('busboy');
  const path = require('path');
  const os = require('os');
  const fs = require('fs');
  const busboy = new BusBoy({ headers: req.headers });
  let imageToBeUploaded = {};
  let imageFileName;
  let thumbnailUrl;

  busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
    if (mimetype !== 'image/jpeg' && mimetype !== 'image/png') {
      return res.status(400).json({ error: 'Wrong file type submitted' });
    }

    // my.image.png => ['my', 'image', 'png']
    const imageExtension = filename.split('.')[filename.split('.').length - 1];

    imageFileName = `${(+new Date()).toString()}.${imageExtension}`;

    const filepath = path.join(os.tmpdir(), imageFileName);

    imageToBeUploaded = { filepath, mimetype };
    file.pipe(fs.createWriteStream(filepath));
  });

  busboy.on('finish', () => {
    admin
      .storage()
      .bucket()
      .upload(imageToBeUploaded.filepath, {
        resumable: false,
        metadata: {
          metadata: {
            contentType: imageToBeUploaded.mimetype,
          },
        },
      })
      .then(() => {
        db.runTransaction((t) => {
          return t
            .get(itemRef)
            .then((doc) => {
              if (!doc.exists) {
                return res.status(404).json({ error: 'Item not found' });
              }
              thumbnailUrl = `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${imageFileName}?alt=media`;
              t.update(itemRef, { thumbnailUrl });

              const itemCategoryList = doc.data().categories;

              if (
                !Array.isArray(itemCategoryList) ||
                !itemCategoryList.length
              ) {
                return res.json({ message: 'image uploaded successfully' });
              }

              return db
                .collection('menu')
                .where(`${itemId}.itemId`, '==', itemId)
                .get()
                .then((categoryQuery) => {
                  const previewThumbnailUrl = `${itemId}.thumbnailUrl`;

                  categoryQuery.forEach((category) => {
                    const categoryRef = db.doc(`/menu/${category.id}`);

                    t.update(categoryRef, {
                      [previewThumbnailUrl]: thumbnailUrl,
                    });
                  });

                  return null;
                })
                .then(() => {
                  return res.json({ message: 'image uploaded successfully' });
                })
                .catch((err) => {
                  console.error(err);
                  return res.status(500).json({
                    error: 'something went wrong while updating item previews.',
                  });
                });
            })
            .catch((err) => {
              console.error(err);
              return res.status(500).json({
                error: 'something went wrong while updating item.',
              });
            });
        });
      })
      .catch((err) => {
        console.error(err);
        return res.status(500).json({
          error: 'Something went wrong.',
        });
      });
  });

  busboy.end(req.rawBody);
};

exports.createCategory = (req, res) => {
  let categoryData = {
    settings: {
      name: req.body.name,
      itemList: Object.assign({}, req.body.itemList),
      letter: req.body.letter,
      active: req.body.active ? req.body.active : false,
    },
  };
  const { valid, errors } = validateCategoryData(categoryData.settings);

  if (!valid) return res.status(400).json(errors);

  db.runTransaction((t) => {
    return db
      .collection('menu')
      .where('settings.name', '==', categoryData.settings.name)
      .get()
      .then((doc) => {
        if (doc.size > 0) {
          return res.status(400).json({
            error: `A category with the same name already exists. Please rename or modify the existing one.`,
          });
        }

        return db
          .collection('menuItems')
          .where('itemId', 'in', req.body.itemList)
          .get()
          .then((data) => {
            data.forEach((item) => {
              categoryData[item.data().itemId] = {
                itemId: item.data().itemId,
                name: item.data().name,
                description: item.data().description,
                price: item.data().price,
                thumbnailUrl: item.data().thumbnailUrl,
                active: item.data().active,
              };
              t.update(db.doc(`/menuItems/${item.data().itemId}`), {
                categories: FieldValue.arrayUnion(req.body.name),
              });
            });

            return db.collection('menu').add(categoryData);
          })
          .then((docRef) => {
            return db
              .doc(`/menu/${docRef.id}`)
              .update({ 'settings.categoryId': docRef.id });
          })
          .then(() => {
            return res.json({
              message: `Category created successfully.`,
            });
          });
      })
      .catch((err) => {
        console.error(err);
        return res.status(500).json({ error: 'Something went wrong' });
      });
  });
};

exports.updateCategory = (req, res) => {
  let newSettings = req.body;
  const catRef = db.doc(`/menu/${req.params.catId}`);

  catRef
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({ error: 'Category not found' });
      }
      for (key of Object.keys(newSettings)) {
        newSettings[`settings.${key}`] = newSettings[key];
        delete newSettings[key];
      }

      return catRef.update(newSettings);
    })
    .then(() => {
      return res.json({ message: 'Details updated successfully' });
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};

exports.addItemToCategory = (req, res) => {
  let toBeAddedItemList = req.body.itemList;
  const { valid, errors } = validateItemListData({
    itemList: toBeAddedItemList,
  });

  if (!valid) return res.status(400).json(errors);

  const categoryRef = db.doc(`/menu/${req.params.catId}`);
  let newItemList = {};
  let categoryName;

  db.runTransaction((t) => {
    return t
      .get(categoryRef)
      .then((doc) => {
        if (!doc.exists) {
          return res.status(404).json({ error: 'Category not found' });
        }

        const existingItemList = Object.values(doc.data().settings.itemList);
        // filter out duplicate item(s) from the list
        toBeAddedItemList = toBeAddedItemList.filter(
          (item) => existingItemList.indexOf(item) < 0
        );

        if (!Array.isArray(toBeAddedItemList) || !toBeAddedItemList.length) {
          return res.status(400).json({
            error: `Item(s) already exists in ${doc.data().settings.name}`,
          });
        }
        // concatenate arrays and then convert into object
        newItemList = Object.assign(
          {},
          existingItemList.concat(toBeAddedItemList)
        );
        categoryName = doc.data().settings.name;

        return db
          .collection('menuItems')
          .where('itemId', 'in', toBeAddedItemList)
          .get()
          .then((query) => {
            let toBeAddedItemData = { 'settings.itemList': newItemList };

            query.forEach((item) => {
              toBeAddedItemData[item.data().itemId] = {
                itemId: item.data().itemId,
                name: item.data().name,
                description: item.data().description,
                price: item.data().price,
                thumbnailUrl: item.data().thumbnailUrl,
                active: item.data().active,
              };
              t.update(db.doc(`/menuItems/${item.data().itemId}`), {
                categories: FieldValue.arrayUnion(categoryName),
              });
            });

            return toBeAddedItemData;
          })
          .then((toBeAddedItemData) => {
            t.update(categoryRef, toBeAddedItemData);

            return null;
          })
          .then(() => {
            return res.json({
              message: `Item(s) added successfully.`,
            });
          });
      })
      .catch((err) => {
        console.error(err);
        return res.status(500).json({
          error: 'Something went wrong',
        });
      });
  });
};

exports.deleteItem = (req, res) => {
  const itemId = req.params.itemId;
  const itemRef = db.doc(`/menuItems/${itemId}`);

  db.runTransaction((t) => {
    return t
      .get(itemRef)
      .then((doc) => {
        if (!doc.exists) {
          return res.status(404).json({ error: 'Item not found' });
        }
        t.delete(itemRef);

        const itemCategoryList = doc.data().categories;

        if (!Array.isArray(itemCategoryList) || !itemCategoryList.length) {
          return res.json({ message: 'Item deleted successfully' });
        }

        return db
          .collection('menu')
          .where(`${itemId}.itemId`, '==', itemId)
          .get()
          .then((categoryQuery) => {
            categoryQuery.forEach((category) => {
              const categoryRef = db.doc(`/menu/${category.id}`);
              const categoryItemList = Object.values(
                category.data().settings.itemList
              );
              const index = categoryItemList.indexOf(itemId);

              categoryItemList.splice(index, 1);
              t.update(categoryRef, {
                [itemId]: FieldValue.delete(),
                'settings.itemList': categoryItemList,
              });
            });

            return null;
          })
          .then(() => {
            return res.json({ message: 'Item deleted successfully' });
          });
      })
      .catch((err) => {
        console.error(err);
        return res.status(500).json({ error: err.code });
      });
  });
};

exports.deleteItemFromCategory = (req, res) => {
  const itemList = req.body.itemList;
  const { valid, errors } = validateItemListData({ itemList });

  if (!valid) return res.status(400).json(errors);

  const categoryRef = db.doc(`/menu/${req.params.catId}`);

  db.runTransaction((t) => {
    return t
      .get(categoryRef)
      .then((doc) => {
        if (!doc.exists) {
          return res.status(404).json({ error: 'Category not found' });
        }

        const categoryItemList = Object.values(doc.data().settings.itemList);

        itemList.forEach((itemId) => {
          const itemRef = db.doc(`/menuItems/${itemId}`);
          const index = categoryItemList.indexOf(itemId);

          if (index > -1) {
            t.update(categoryRef, {
              [itemId]: FieldValue.delete(),
            });
            t.update(itemRef, {
              categories: FieldValue.arrayRemove(doc.data().settings.name),
            });
            categoryItemList.splice(index, 1);
          }
        });

        return categoryItemList;
      })
      .then((categoryItemList) => {
        t.update(categoryRef, { 'settings.itemList': categoryItemList });

        return null;
      })
      .then(() => {
        return res.json({ message: `Item(s) deleted successfully.` });
      })
      .catch((err) => {
        console.error(err);
        return res.status(500).json({ error: err.code });
      });
  });
};

exports.deleteCategory = (req, res) => {
  const categoryRef = db.doc(`/menu/${req.params.catId}`);

  db.runTransaction((t) => {
    return t
      .get(categoryRef)
      .then((doc) => {
        if (!doc.exists) {
          return res.status(404).json({ error: 'Category not found' });
        }

        for (item in doc.data()) {
          if (item !== 'settings') {
            t.update(db.doc(`/menuItems/${item}`), {
              categories: FieldValue.arrayRemove(doc.data().settings.name),
            });
          }
        }

        return null;
      })
      .then(() => {
        t.delete(categoryRef);

        return null;
      })
      .then(() => {
        return res.json({ message: 'Category deleted successfully' });
      })
      .catch((err) => {
        console.error(err);
        return res.status(500).json({ error: err.code });
      });
  });
};
