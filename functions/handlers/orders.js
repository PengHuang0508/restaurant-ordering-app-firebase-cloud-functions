const { db } = require('../utils/admin');
const {
  validateOrderData,
  validateDineInOrderData,
  validateOrderChanges,
} = require('../utils/validators');
const settings = require('../utils/settings');

exports.getOrder = (req, res) => {
  const orderId = req.params.orderId;

  db.collectionGroup('dailyOrders')
    .where('orderId', '==', orderId)
    .limit(1)
    .get()
    .then((doc) => {
      if (doc.size == 0) {
        return res.status(404).json({ error: 'Order not found' });
      }

      let orderData = doc.docs[0].data();

      if (req.user.uid === orderData.senderId) {
        return res.json(orderData);
      }

      // If user is not the sender, then checking admin
      return db
        .collection('users')
        .where('userId', '==', req.user.uid)
        .limit(1)
        .get()
        .then((data) => {
          if (data.size > 0) {
            return res.json(orderData);
          }

          return res.status(403).json({
            error: 'Need to be the sender or an admin to view the order.',
          });
        });
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};

exports.sendOrder = (req, res) => {
  const newOrder = {
    contact: req.body.contact ? req.body.contact : {},
    createdAt: new Date().toISOString(),
    itemList: req.body.itemList,
    senderId: req.user.uid,
    status: req.body.status ? req.body.status : 'OPEN',
    subtotal: req.body.subtotal,
    type: req.body.type ? req.body.type : 'PICK-UP',
    paymentInformation: {
      paymentMethod: req.body.paymentMethod,
    },
  };

  const { valid, errors } = validateOrderData(newOrder);

  if (!valid) return res.status(400).json(errors);

  const orderDate = newOrder.createdAt.split('T')[0];

  return db
    .collection('orders')
    .doc(orderDate)
    .collection('dailyOrders')
    .add(newOrder)
    .then((docRef) => {
      const orderId = docRef.id;

      return db
        .collection('orders')
        .doc(orderDate)
        .collection('dailyOrders')
        .doc(orderId)
        .update({ orderId })
        .then(() => {
          return res.json({ orderId, message: `Order sent successfully` });
        });
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: 'something went wrong' });
    });
};

exports.getDineInOrder = (req, res) => {
  const orderId = req.params.orderId;

  db.collectionGroup('dailyOrders')
    .where('orderId', '==', orderId)
    .limit(1)
    .get()
    .then((doc) => {
      if (doc.size == 0) {
        return res.status(404).json({ error: 'Order not found' });
      }

      let orderData = doc.docs[0].data();

      if (!orderData.table) {
        return res.status(403).json({ error: 'This is not a dine-in order.' });
      }

      return res.json(orderData);
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};

exports.sendDineInOrder = (req, res) => {
  const newOrder = {
    createdAt: new Date().toISOString(),
    itemList: req.body.itemList,
    status: req.body.status ? req.body.status : 'OPEN',
    senderId: req.user.uid ? req.user.uid : '',
    subtotal: req.body.subtotal,
    table: req.body.table ? req.body.table : '',
    type: 'DINE-IN',
  };

  const { valid, errors } = validateDineInOrderData(newOrder);

  if (!valid) return res.status(400).json(errors);

  const orderDate = newOrder.createdAt.split('T')[0];

  // Check if the table is available
  db.collectionGroup('dailyOrders')
    .where('table', '==', newOrder.table)
    .where('status', '==', 'OPEN')
    .limit(1)
    .get()
    .then((doc) => {
      if (doc.size > 0) {
        return res.status(400).json({
          error:
            'There is an open order for this table. Please close the existing order first.',
        });
      }

      return db
        .collection('orders')
        .doc(orderDate)
        .collection('dailyOrders')
        .add(newOrder)
        .then((docRef) => {
          const orderId = docRef.id;

          return db
            .collection('orders')
            .doc(orderDate)
            .collection('dailyOrders')
            .doc(orderId)
            .update({ orderId })
            .then(() => {
              return res.json({
                orderId,
                message: `Order sent successfully`,
              });
            });
        });
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: 'something went wrong' });
    });
};
exports.addToOrder = (req, res) => {
  const orderId = req.params.orderId;
  const orderData = {
    subtotal: req.body.subtotal,
  };

  const { valid, errors } = validateOrderChanges(orderData);

  if (!valid) return res.status(400).json(errors);

  db.collectionGroup('dailyOrders')
    .where('orderId', '==', orderId)
    .limit(1)
    .get()
    .then((doc) => {
      if (doc.size == 0) {
        return res.status(404).json({ error: 'Order not found' });
      }

      if (
        doc.docs[0].data().type !== 'DINE-IN' ||
        !doc.docs[0].data().table ||
        doc.docs[0].data().status !== 'OPEN'
      ) {
        return res.status(403).json({
          error:
            'Cannot add items to this order, either because this is not a dine-in order or it is not a open order.',
        });
      }

      orderData.itemList = doc.docs[0]
        .data()
        .itemList.concat(req.body.itemList);

      const orderDate = doc.docs[0].data().createdAt.slice(0, 10);

      return db
        .collection('orders')
        .doc(orderDate)
        .collection('dailyOrders')
        .doc(orderId)
        .update(orderData)
        .then(() => {
          return res.json({ message: 'Order updated successfully' });
        });
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};
exports.getOpenOrders = (req, res) => {
  db.collectionGroup('dailyOrders')
    .where('status', '==', 'OPEN')
    .get()
    .then((docs) => {
      let orders = [];
      docs.forEach((doc) => {
        orders.push({
          createdAt: doc.data().createdAt,
          itemList: doc.data().itemList,
          orderId: doc.data().orderId,
          sender: doc.data().senderId,
          status: doc.data().status,
          table: doc.data().table,
        });
      });
      return res.json(orders);
    })
    .catch((err) => console.error(err));
};

exports.getOrders = (req, res) => {
  // 2020-04-07T00:00:00.000Z/to/2020-04-07T23:59:59.999Z
  const timeInterval = {
    startingTime: req.params.startingTime,
    endingTime: req.params.endingTime,
  };

  db.collectionGroup('dailyOrders')
    .where('createdAt', '>=', timeInterval.startingTime)
    .where('createdAt', '<=', timeInterval.endingTime)
    .get()
    .then((data) => {
      let orders = [];
      data.forEach((doc) => {
        orders.push({
          createdAt: doc.data().createdAt,
          itemList: doc.data().itemList,
          orderId: doc.data().orderId,
          sender: doc.data().senderId,
          status: doc.data().status,
          table: doc.data().table,
        });
      });
      return res.json(orders);
    })
    .catch((err) => console.error(err));
};

exports.updateOrder = (req, res) => {
  const orderId = req.params.orderId;
  const orderData = req.body;
  const { valid, errors } = validateOrderChanges(orderData);

  if (!valid) return res.status(400).json(errors);

  db.collectionGroup('dailyOrders')
    .where('orderId', '==', orderId)
    .limit(1)
    .get()
    .then((doc) => {
      if (doc.size == 0) {
        return res.status(404).json({ error: 'Order not found' });
      }

      let orderDate;
      doc.forEach((order) => {
        orderDate = order.data().createdAt.slice(0, 10);
      });

      return db
        .collection('orders')
        .doc(orderDate)
        .collection('dailyOrders')
        .doc(orderId)
        .update(orderData)
        .then(() => {
          return res.json({ message: 'Order updated successfully' });
        });
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};

exports.closeOrder = (req, res) => {
  const orderId = req.params.orderId;
  let paymentInformation = {
    // payment method: CASH/DEBIT/CREDIT/VOUCHER
    paymentMethod: req.body.paymentMethod,
    subtotal: req.body.subtotal,
    discount: req.body.discount ? req.body.discount : 0,
    taxes: req.body.taxes,
    total: req.body.total,
  };

  db.collectionGroup('dailyOrders')
    .where('orderId', '==', orderId)
    .limit(1)
    .get()
    .then((doc) => {
      if (doc.size == 0) {
        return res.status(404).json({ error: 'Order not found' });
      }

      let orderDate;
      let orderTotal = 0;

      doc.forEach((order) => {
        orderDate = order.data().createdAt.slice(0, 10);
        order.data().itemList.forEach((item) => {
          orderTotal += item.price * item.quantity;
        });
      });
      // Re-calculate to verify the amount matches the request
      // subtotal = item price * item quantity
      // discount = req.body.discount
      // taxes = (subtotal - discount) * GST
      // total = subtotal - discount + taxes
      // or
      // total = (subtotal - discount) * (1 + GST)
      orderTotal = parseFloat(
        (
          (orderTotal - paymentInformation.discount) *
          (1 + settings.GST)
        ).toFixed(2)
      );

      if (paymentInformation.total !== orderTotal) {
        return res.status(400).json({
          error: `Please re-verify the total amount. Total calculated by sender is ${orderTotal}.`,
        });
      }

      const orderRef = db.doc(`/orders/${orderDate}/dailyOrders/${orderId}`);

      return orderRef
        .update({ status: 'CLOSED', paymentInformation })
        .then(() => {
          return res.json({ message: 'Order closed successfully.' });
        });
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};

exports.deleteOrder = (req, res) => {
  const orderList = req.body.orderList;

  orderList.forEach((orderId) => {
    db.collectionGroup('dailyOrders')
      .where('orderId', '==', orderId)
      .limit(1)
      .get()
      .then((doc) => {
        if (doc.size > 0) {
          let orderDate;

          doc.forEach((order) => {
            orderDate = order.data().createdAt.slice(0, 10);
          });

          const orderRef = db
            .collection('orders')
            .doc(orderDate)
            .collection('dailyOrders')
            .doc(orderId);

          return orderRef.delete();
        }
        return;
      })
      .catch((err) => {
        console.error(err);
        return res.status(500).json({ error: err.code });
      });
  });

  return res.json({ message: 'Orders deleted successfully.' });
};
