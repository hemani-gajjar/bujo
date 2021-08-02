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

const app = express();

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(
  express.urlencoded({
    extended: true,
  })
);

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

//userSchema - for user database
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
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
      callbackURL: "http://localhost:3000/auth/google/bujo",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    function (accessToken, refreshToken, profile, cb) {
      User.findOrCreate({ googleId: profile.id }, function (err, user) {
        return cb(err, user);
      });
    }
  )
);

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

app.get("/", function (req, res) {
  res.render("first");
});

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile"] })
);

app.get(
  "/auth/google/bujo",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function (req, res) {
    // Successful authentication, redirect home.
    res.redirect("/home");
  }
);

//-------------------------register---------------------------------
app
  .route("/register")

  .get(function (req, res) {
    res.render("register");
  })

  .post(function (req, res) {
    User.register(
      { username: req.body.username },
      req.body.password,
      function (err, user) {
        if (err) {
          console.log(err);
          res.redirect("/register");
        } else {
          passport.authenticate("local")(req, res, function () {
            res.redirect("/home");
          });
        }
      }
    );
  });

//----------------------------login------------------------------
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
          res.redirect("/home");
        });
      }
    });
  });
//-----------------------------------------------------------------
app.get("/logout", function (req, res) {
  req.logout();
  res.redirect("/");
});

app.get("/home", function (req, res) {
  if (req.isAuthenticated()) {
    List.find({}, function (err, allLists) {
      if (!err) {
        res.render("home", { listArray: allLists });
      }
    });
  } else {
    res.redirect("/login");
  }
});

app.get("/new-list", function (req, res) {
  res.render("new-list");
});

//dynamic URL
app.get("/lists/:listName", function (req, res) {
  const requestedListName = req.params.listName;
  if (requestedListName !== "favicon.ico") {
    List.findOne({ name: requestedListName }, function (err, foundList) {
      if (!err) {
        res.render("list", {
          foundList: foundList,
          listName: requestedListName,
        });
      }
    });
  }
});

app.get("/lists/:listName/compose", function (req, res) {
  const requestedListName = req.params.listName;

  List.findOne({ name: requestedListName }, function (err, foundList) {
    if (!err) {
      res.render("compose", { listName: requestedListName });
    }
  });
});

app.get("/lists/:listName/:entryID", function (req, res) {
  if (req.isAuthenticated()) {
    const requestedListName = req.params.listName;
    const requestedEntryId = req.params.entryID;

    List.findOne({ name: requestedListName }, function (err, foundList) {
      let displayTitle = "";
      let displayContent = "";
      for (let i = 0; i < foundList.entries.length; i++) {
        if (foundList.entries[i]._id == requestedEntryId) {
          displayTitle = foundList.entries[i].title;
          displayContent = foundList.entries[i].content;
        }
      }
      if (!err) {
        res.render("entry", {
          listName: requestedListName,
          entryTitle: displayTitle,
          entryContent: displayContent,
        });
      }
    });
  } else {
    res.redirect("/login");
  }
});

app.post("/lists/:listName/compose", function (req, res) {
  const requestedListName = req.params.listName;

  //newEntry
  const newEntry = new Entry({
    title: req.body.entryTitle,
    content: req.body.entryContent,
  });

  List.findOneAndUpdate(
    { name: requestedListName },
    { $push: { entries: newEntry } },
    function (err) {
      if (!err) {
        res.redirect(`/lists/${requestedListName}`);
      } else {
        console.log(err);
      }
    }
  );
});

app.post("/new-list", function (req, res) {
  //newList item
  const newList = new List({
    name: req.body.listName,
  });

  //save the item in the database
  //redirect only after the newList is saved without any errors
  newList.save(function (err) {
    if (!err) {
      res.redirect("/home");
    }
  });
});

app.post("/delete", function (req, res) {
  const deleteButtonId = req.body.deleteButton;

  List.findByIdAndRemove(deleteButtonId, function (err) {
    if (err) {
      console.log(err);
    } else {
      res.redirect("/home");
    }
  });
});

app.post("/lists/:listName/delete", function (req, res) {
  const listDeleteButtonId = req.body.listDeleteButton;
  const requestedListName = req.params.listName;

  List.findOneAndUpdate(
    { name: requestedListName },
    { $pull: { entries: { _id: listDeleteButtonId } } },
    { safe: true, upsert: true },
    function (err) {
      if (!err) {
        res.redirect(`/lists/${requestedListName}`);
      } else {
        console.log(err);
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
