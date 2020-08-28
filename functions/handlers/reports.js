const { db } = require('../utils/admin');

exports.dailyReport = (req, res) => {
  // 2020-04-07T00:00:00.000Z/to/2020-04-07T23:59:59.999Z
  const timeInterval = {
    startingTime: req.params.startingTime,
    endingTime: req.params.endingTime,
  };

  let dailySalesReport = {
    numberOfOrders: 0,
    subtotal: 0,
    discount: 0,
    taxes: 0,
    total: 0,
  };

  db.collectionGroup('dailyOrders')
    .where('createdAt', '>=', timeInterval.startingTime)
    .where('createdAt', '<=', timeInterval.endingTime)
    .where('status', '==', 'OPEN')
    .get()
    .then((doc) => {
      if (doc.size > 0) {
        return res.status(400).json({
          error: `There is one or more open orders. Please close the order(s) first.`,
        });
      }

      return db
        .collectionGroup('dailyOrders')
        .where('createdAt', '>=', timeInterval.startingTime)
        .where('createdAt', '<=', timeInterval.endingTime)
        .get()
        .then((orders) => {
          orders.forEach((order) => {
            dailySalesReport.numberOfOrders++;
            dailySalesReport.subtotal += order.data().paymentInformation.subtotal;
            dailySalesReport.discount += order.data().paymentInformation.discount;
            dailySalesReport.taxes += order.data().paymentInformation.taxes;
            dailySalesReport.total += order.data().paymentInformation.total;
          });

          for (key in dailySalesReport) {
            dailySalesReport[key] = parseFloat(
              dailySalesReport[key].toFixed(2)
            );
          }

          dailySalesReport.reportDate = timeInterval.startingTime.slice(0, 10);

          const reportRef = db.doc(`/orders/${dailySalesReport.reportDate}`);

          return reportRef.set({ dailySalesReport }).then(() => {
            return res.json(dailySalesReport);
          });
        });
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: 'Something went wrong' });
    });
};

exports.monthlyReport = (req, res) => {
  // 2020-03-29/to/2020-04-07
  const dateInterval = {
    startingDate: req.params.startingDate,
    endingDate: req.params.endingDate,
  };
  let monthlySalesReport = {
    numberOfOrders: 0,
    subtotal: 0,
    discount: 0,
    taxes: 0,
    total: 0,
  };

  return db
    .collection('orders')
    .where('dailySalesReport.reportDate', '>=', dateInterval.startingDate)
    .where('dailySalesReport.reportDate', '<=', dateInterval.endingDate)
    .get()
    .then((reports) => {
      reports.forEach((report) => {
        monthlySalesReport.numberOfOrders += report.data().dailySalesReport.numberOfOrders;
        monthlySalesReport.subtotal += report.data().dailySalesReport.subtotal;
        monthlySalesReport.discount += report.data().dailySalesReport.discount;
        monthlySalesReport.taxes += report.data().dailySalesReport.taxes;
        monthlySalesReport.total += report.data().dailySalesReport.total;
      });

      for (key in monthlySalesReport) {
        monthlySalesReport[key] = parseFloat(
          monthlySalesReport[key].toFixed(2)
        );
      }

      monthlySalesReport.reportDate = dateInterval.startingDate.slice(0, 7);
      monthlySalesReport.reportDuration = `${dateInterval.startingDate} to ${dateInterval.endingDate}`;

      const reportRef = db.doc(`/reports/${monthlySalesReport.reportDate}`);

      return reportRef.set(monthlySalesReport).then(() => {
        return res.json(monthlySalesReport);
      });
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: 'Something went wrong' });
    });
};
