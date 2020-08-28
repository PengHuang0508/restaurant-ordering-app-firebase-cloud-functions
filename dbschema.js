let db = {
  menu: [
    {
      name: String,
      desc: String,
      type: String,
      category: String,
      price: Number,
      imageUrl: String,
      createdAt: String,
      active: Boolean,
      isSoldOut: Boolean,
      //optional
      isSpecialty: Boolean,
      isRecommended: Boolean,
      isLimitedTime: Boolean
    },
    //example
    {
      name: 'Tofu',
      desc:
        'Tofu, also known as bean curd, is a food prepared by coagulating soy milk and then pressing the resulting curds into solid white blocks of varying softness.',
      type: 'food',
      category: 'vegetable',
      price: 12.34,
      imageUrl: `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/default.png?alt=media`,
      createdAt: '2019-12-29T06:49:29.656Z',
      active: false,
      isSoldOut: true,
      isRecommended: true
    }
  ],
  order: [
    {
      table: String,
      server: String,
      status: String, // Open order: "pending", "sent"; Closed order: "paid", "wrong"
      isSent: Boolean,
      sentTime: Number,
      isPaid: Boolean,
      paidTime: Number,
      itemList: [
        {
          name: String,
          quantity: Number,
          instruction: String,
          addon: [
            {
              item: String,
              price: Number
            }
          ],
          price: Number
        }
      ]
    }
  ]
};

const notification = {
  notifications: [
    {
      recipient: String,
      sender: String,
      read: Boolean,
      message: String,
      createdAt: String
    }
  ],
  announcements: [],
  alerts: []
};
const userDetails = {
  credentials: {
    userId: String,
    username: String,
    handle: String,
    createdAt: String
  }
};
