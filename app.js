const express = require("express");
const mongoose = require("mongoose");

const app = express();

app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

mongoose.connect("mongodb://localhost:27017/bujoDB", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

//to remove the deprecation warning
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

let allListsArray = [];
app.get("/", function (req, res) {
  List.find({}, function (err, allLists) {
    if (!err) {
      res.render("home", { listArray: allLists });
    }
  });
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
      res.redirect("/");
    }
  });
});

app.post("/delete", function (req, res) {
  const deleteButtonId = req.body.deleteButton;

  List.findByIdAndRemove(deleteButtonId, function (err) {
    if (err) {
      console.log(err);
    } else {
      res.redirect("/");
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

app.listen(3000, function () {
  console.log("Server has started successfully.");
});
