//jshint esversion:6
require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const findOrCreate = require("mongoose-findorcreate");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const util = require("util");

const app = express();

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(
  express.urlencoded({
    extended: true,
  })
);
app.use(express.json());

app.use(
  session({
    secret: "Our little hem and J secret.",
    resave: false,
    saveUninitialized: false,
  })
); //initial configuration

//to initialize passport and set up session using it
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(
  "mongodb+srv://admin-hemani:bujo-admin0987@cluster0.axslz.mongodb.net/bujoDB",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

//to remove the deprecation warnings
mongoose.set("useCreateIndex", true);
mongoose.set("useFindAndModify", false);

//defining a mongoose Schema for individual entries
const entrySchema = {
  title: String,
  content: String,
};

//Mongoose model based on the entrySchema
const Entry = mongoose.model("Entry", entrySchema);

//defining a mongoose Schema for the lists
const listSchema = {
  name: String,
  entries: [entrySchema],
};

//Mongoose model based on the listSchema
const List = mongoose.model("List", listSchema);

//userSchema - for user database
const userSchema = new mongoose.Schema({
  name: String,
  username: String,
  password: String,
  googleId: String,
  userlists: [listSchema],
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

//Mongoose model based on the userSchema
const User = new mongoose.model("User", userSchema);

//passport local configuration
passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, user) {
    done(err, user);
  });
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: "https://bujo0208.herokuapp.com/auth/google/bujo",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    function (accessToken, refreshToken, profile, cb) {
      User.findOne({ googleId: profile.id }, function (err, user) {
        if (err) {
          console.log(err);
          return cb(err);
        } else {
        }
        //No user found, create a new user with values from Google
        if (!user) {
          user = new User({
            name: profile.displayName,
            username: profile.emails[0].value,
            googleId: profile._json.sub,
          });

          user.save(function (err) {
            if (err) {
              console.log(err);
            } else {
              console.log("saved successfully");
              return cb(err, user);
            }
          });
        } else {
          //return found user
          return cb(err, user);
        }
      });
    }
  )
);

app.get("/", function (req, res) {
  res.render("first");
});

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["email", "profile"] })
);

app.get(
  "/auth/google/bujo",
  passport.authenticate("google", {
    // successRedirect: "/auth/google/success",
    failureRedirect: "/login",
  }),
  function (req, res) {
    let userId = req.user._id;

    // Successful authentication, redirect user home.
    res.redirect(`/${userId}/home`);
  }
);

//-------------------------Register---------------------------------

app
  .route("/register")

  .get(function (req, res) {
    // console.log(userId);
    res.render("register");
  })

  .post(function (req, res) {
    console.log(req.body);

    User.register(
      { name: req.body.name, username: req.body.username },
      req.body.password,
      function (err, user) {
        if (err) {
          console.log(err);
          res.redirect("/register");
        } else {
          passport.authenticate("local")(req, res, function () {
            User.findOne(
              { username: req.body.username },
              function (err, foundUser) {
                if (!err) {
                  res.redirect(`/${foundUser._id}/home`);
                }
              }
            );
          });
        }
      }
    );
  });

//----------------------------Login------------------------------

app
  .route("/login")
  .get(function (req, res) {
    res.render("login");
  })
  .post(function (req, res) {
    const user = new User({
      username: req.body.username,
      password: req.body.password,
    });

    req.login(user, function (err) {
      if (err) {
        console.log(err);
      } else {
        passport.authenticate("local")(req, res, function () {
          User.findOne(
            { username: req.body.username },
            function (err, foundUser) {
              if (!err) {
                res.redirect(`/${foundUser._id}/home`);
              }
            }
          );
        });
      }
    });
  });

//-----------------------------------------------------------------

app.get("/logout", function (req, res) {
  req.logout();
  res.redirect("/");
});

app.get("/:userId/home", function (req, res) {
  const requestedUserId = req.params.userId;
  if (req.isAuthenticated()) {
    User.findOne({ _id: requestedUserId }, function (err, foundUser) {
      if (!err) {
        res.render("home", {
          listArray: foundUser.userlists,
          userId: requestedUserId,
          userName: foundUser.name,
        });
      }
    });
  } else {
    res.redirect("/login");
  }
});

app.get("/:userId/new-list", function (req, res) {
  const requestedUserId = req.params.userId;
  res.render("new-list", { userId: requestedUserId });
});

//dynamic URL
app.get("/:userId/lists/:listName", function (req, res) {
  const requestedListName = req.params.listName;
  const requestedUserId = req.params.userId;
  if (requestedListName !== "favicon.ico") {
    User.findOne({ _id: requestedUserId }, function (err, foundUser) {
      if (!err) {
        let len = foundUser.userlists.length;
        for (let i = 0; i < len; i++) {
          if (foundUser.userlists[i].name === requestedListName) {
            res.render("list", {
              foundList: foundUser.userlists[i],
              listName: requestedListName,
              userId: requestedUserId,
            });
          }
        }
      }
    });
  }
});

app.get("/:userId/lists/:listName/compose", function (req, res) {
  const requestedListName = req.params.listName;
  const requestedUserId = req.params.userId;

  User.findOne({ _id: requestedUserId }, function (err, foundUser) {
    if (!err) {
      res.render("compose", {
        userId: requestedUserId,
        listName: requestedListName,
      });
    }
  });
});

app.get("/:userId/lists/:listName/:entryID", function (req, res) {
  if (req.isAuthenticated()) {
    const requestedListName = req.params.listName;
    const requestedEntryId = req.params.entryID;
    const requestedUserId = req.params.userId;

    User.findOne({ _id: requestedUserId }, function (err, foundUser) {
      let displayTitle = "";
      let displayContent = "";
      let listIdx = 0;
      for (let i = 0; i < foundUser.userlists.length; i++) {
        if (foundUser.userlists[i].name === requestedListName) {
          listIdx = i;
        }
      }

      let entriesArray = foundUser.userlists[listIdx].entries;

      for (let i = 0; i < entriesArray.length; i++) {
        if (foundUser.userlists[listIdx].entries[i]._id == requestedEntryId) {
          displayTitle = entriesArray[i].title;
          displayContent = entriesArray[i].content;
        }
      }

      if (!err) {
        res.render("entry", {
          listName: requestedListName,
          entryTitle: displayTitle,
          entryContent: displayContent,
          userId: requestedUserId,
        });
      }
    });
  } else {
    res.redirect("/login");
  }
});

app.post("/:userId/lists/:listName/compose", function (req, res) {
  const requestedListName = req.params.listName;
  const requestedUserId = req.params.userId;

  //newEntry
  const newEntry = new Entry({
    title: req.body.entryTitle,
    content: req.body.entryContent,
  });

  User.findOneAndUpdate(
    { _id: requestedUserId },
    { $push: { "userlists.$[idx].entries": newEntry } },
    { arrayFilters: [{ "idx.name": requestedListName }] },
    function (err) {
      if (!err) {
        res.redirect(`/${requestedUserId}/lists/${requestedListName}`);
      } else {
        console.log(err);
      }
    }
  );
});

app.post("/:userId/new-list", function (req, res) {
  const requestedUserId = req.params.userId;

  //newList item
  const newList = new List({
    name: req.body.listName,
  });

  User.findOneAndUpdate(
    {
      _id: requestedUserId,
    },
    { $push: { userlists: newList } },
    function (err) {
      if (!err) {
        res.redirect(`/${requestedUserId}/home`);
      } else {
        console.log(err);
      }
    }
  );
});

app.post("/:userId/delete", function (req, res) {
  const requestedUserId = req.params.userId;
  const deleteButtonId = req.body.deleteButton;

  User.findOneAndUpdate(
    { _id: requestedUserId },
    { $pull: { userlists: { _id: deleteButtonId } } },
    function (err) {
      if (!err) {
        res.redirect(`/${requestedUserId}/home`);
      }
    }
  );
});

app.post("/:userId/lists/:listName/delete", function (req, res) {
  const listDeleteButtonId = req.body.listDeleteButton;
  const requestedListName = req.params.listName;
  const requestedUserId = req.params.userId;

  User.findOneAndUpdate(
    { _id: requestedUserId },
    { $pull: { "userlists.$[idx].entries": { _id: listDeleteButtonId } } },
    { arrayFilters: [{ "idx.name": requestedListName }] },
    function (err) {
      if (!err) {
        res.redirect(`/${requestedUserId}/lists/${requestedListName}`);
      }
    }
  );
});

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}

app.listen(port, function () {
  console.log("Server has started successfully.");
});
