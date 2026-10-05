// Rating categories and their weights.
var GROUPS = [
  {
    t: "Taste",
    w: 3,
    items: [
      ["Sourness", "5 = pleasant, lively acidity; 1 = sharp or flat"],
      ["Bitterness", "5 = pleasant depth; 1 = harsh or burnt"],
      ["Sweetness", "Natural sweetness in the shot"],
      ["Balance", "How well sour, bitter and sweet fit together"]
    ]
  },
  {
    t: "Texture and finish",
    w: 2,
    items: [
      ["Creaminess", "Mouthfeel and crema"],
      ["Crema look", "Colour, thickness, how long it lasts"],
      ["Body", "Thin and watery to syrupy"],
      ["Aftertaste", "Pleasant and lingering, or ashy"]
    ]
  },
  {
    t: "Experience",
    w: 1,
    items: [
      ["Dishes", "Look of the cup, saucer, spoon"],
      ["Temperature", "Cup pre-warmed, coffee not lukewarm"],
      ["Service and ambience", "Friendliness, seating, noise"],
      ["Value for money", "Compared with the price"],
      ["Tap water", "yn"]
    ]
  }
];

// Current ratings and saved café entries.
var vals = {};
var KEY = "espresso-tasting-v1";
var saved = [];

function setStatus(message, isError) {
  var status = $("status");
  status.textContent = message;
  status.classList.toggle("error", Boolean(isError));
}

async function requestJSON(path, options) {
  var response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  if (response.status === 204) {
    return null;
  }

  var result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "The request failed.");
  }

  return result;
}

async function migrateLegacyEntries() {
  var storedEntries = localStorage.getItem(KEY);
  if (storedEntries === null) {
    return;
  }

  var legacyEntries = JSON.parse(storedEntries);
  if (!Array.isArray(legacyEntries)) {
    throw new Error("Saved browser data is not in the expected format.");
  }

  for (var index = 0; index < legacyEntries.length; index++) {
    var entry = legacyEntries[index];
    await requestJSON("/api/tastings", {
      method: "POST",
      body: JSON.stringify({
        client_key: "legacy-" + String(entry.id === undefined ? index : entry.id),
        cafe: entry.cafe,
        date: entry.date,
        double_price: entry.double_price ?? entry.price,
        single_price: entry.single_price,
        note: entry.note,
        ratings: entry.ratings || entry.r || {}
      })
    });
  }

  localStorage.removeItem(KEY);
}

// DOM helpers and rating controls.
function $(id) {
  return document.getElementById(id);
}

function build() {
  var groupsElement = $("groups");

  GROUPS.forEach(function (group, groupIndex) {
    var section = document.createElement("section");
    section.innerHTML =
      '<h2>' +
      group.t +
      ' <span class="w">weight x' +
      group.w +
      "</span></h2>";

    group.items.forEach(function (item, itemIndex) {
      var id = groupIndex + "-" + itemIndex;
      var criterion = document.createElement("div");
      criterion.className = "crit";

      if (item[1] === "yn") {
        criterion.innerHTML =
          '<div class="n">Glass of tap water served?</div><div class="yn"></div>';

        [["Yes", 5], ["No", 0]].forEach(function (option) {
          var button = document.createElement("button");
          button.textContent = option[0];
          button.setAttribute("aria-pressed", "false");
          button.dataset.id = id;
          button.dataset.v = option[1];
          button.onclick = function () {
            vals[id] = option[1];
            refresh();
          };
          criterion.lastChild.appendChild(button);
        });
      } else {
        criterion.innerHTML =
          '<div class="n">' +
          item[0] +
          '</div><div class="h">' +
          item[1] +
          '</div><div class="scale"></div>';

        for (var rating = 1; rating <= 5; rating++) {
          (function (ratingValue) {
            var button = document.createElement("button");
            button.textContent = ratingValue;
            button.setAttribute("aria-pressed", "false");
            button.setAttribute("aria-label", item[0] + " " + ratingValue);
            button.dataset.id = id;
            button.dataset.v = ratingValue;
            button.onclick = function () {
              vals[id] = ratingValue;
              refresh();
            };
            criterion.lastChild.appendChild(button);
          })(rating);
        }
      }

      section.appendChild(criterion);
    });

    groupsElement.appendChild(section);
  });
}

function calc() {
  var got = 0;
  var max = 0;

  GROUPS.forEach(function (group, groupIndex) {
    group.items.forEach(function (item, itemIndex) {
      var value = vals[groupIndex + "-" + itemIndex];
      max += 5 * group.w;

      if (value !== undefined) {
        got += value * group.w;
      }
    });
  });

  return Math.round((got / max) * 100);
}

function refresh() {
  document.querySelectorAll("[data-id]").forEach(function (button) {
    button.setAttribute(
      "aria-pressed",
      String(vals[button.dataset.id] === Number(button.dataset.v))
    );
  });

  $("score").textContent = calc();
}

// Report helpers.
function esc(value) {
  return String(value).replace(/[&<>"]/g, function (character) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;"
    }[character];
  });
}

function gavg(ratings, groupIndex) {
  var group = GROUPS[groupIndex];
  var total = 0;
  var count = 0;

  group.items.forEach(function (item, itemIndex) {
    var value = ratings[groupIndex + "-" + itemIndex];

    if (value !== undefined) {
      total += value;
      count++;
    }
  });

  return count ? total / count : null;
}

function f1(value) {
  return value === null ? "-" : (Math.round(value * 10) / 10).toFixed(1);
}

function report(entry) {
  var ratings = entry.ratings;

  if (!ratings) {
    return '<div class="rep empty">This entry was saved before detailed ratings were stored, so only the total score is available.</div>';
  }

  var html = '<div class="rep">';

  GROUPS.forEach(function (group, groupIndex) {
    var average = gavg(ratings, groupIndex);
    html +=
      '<div class="gh"><span>' +
      group.t +
      "</span><span>" +
      f1(average) +
      ' / 5</span></div><div class="bar"><i style="width:' +
      (average ? (average / 5) * 100 : 0) +
      '%"></i></div>';

    group.items.forEach(function (item, itemIndex) {
      var value = ratings[groupIndex + "-" + itemIndex];
      var label = item[1] === "yn" ? "Tap water" : item[0];
      var text =
        value === undefined
          ? "-"
          : item[1] === "yn"
            ? value
              ? "Yes"
              : "No"
            : value + " / 5";

      html +=
        '<div class="ln"><span>' +
        label +
        "</span><b>" +
        text +
        "</b></div>";
    });
  });

  if (entry.note) {
    html +=
      '<div class="gh"><span>Gut impression</span></div><div class="ln" style="display:block">' +
      esc(entry.note) +
      "</div>";
  }

  return html + "</div>";
}

// Ranking and comparison rendering.
function render() {
  var list = $("list");

  if (!saved.length) {
    list.innerHTML =
      '<div class="empty">No cafés saved yet. Rate one and tap Save.</div>';
    $("cmp").innerHTML =
      '<div class="empty">Save two or more cafés to compare them.</div>';
    return;
  }

  var sorted = saved.slice().sort(function (a, b) {
    return b.score - a.score;
  });
  list.innerHTML = "";

  sorted.forEach(function (entry) {
    var details = document.createElement("details");
    details.className = "entry";

    var metadata = [
      entry.date,
      entry.double_price !== "" && entry.double_price !== null
        ? "Double " + entry.double_price + " €"
        : "",
      entry.single_price !== "" && entry.single_price !== null
        ? "Single " + entry.single_price + " €"
        : ""
    ]
      .filter(Boolean)
      .join(", ");

    details.innerHTML =
      '<summary><div class="sc">' +
      entry.score +
      '</div><div class="m"><div>' +
      esc(entry.cafe || "Unnamed café") +
      "</div><div>" +
      esc(metadata) +
      "</div></div></summary>" +
      report(entry);

    var removeButton = document.createElement("button");
    removeButton.className = "act ghost";
    removeButton.textContent = "Remove";
    removeButton.onclick = function () {
      removeTasting(entry.id);
    };

    details.lastChild.appendChild(removeButton);
    list.appendChild(details);
  });

  var table = "<table><tr><th></th>";

  sorted.forEach(function (entry) {
    table += "<th>" + esc(entry.cafe || "Unnamed") + "</th>";
  });

  table += '</tr><tr class="g"><td>Total (of 100)</td>';

  sorted.forEach(function (entry) {
    table += "<td>" + entry.score + "</td>";
  });

  table += "</tr>";

  GROUPS.forEach(function (group, groupIndex) {
    table += '<tr class="g"><td>' + group.t + " (avg of 5)</td>";

    sorted.forEach(function (entry) {
      table +=
        "<td>" +
        (entry.ratings ? f1(gavg(entry.ratings, groupIndex)) : "-") +
        "</td>";
    });

    table += "</tr>";

    group.items.forEach(function (item, itemIndex) {
      table +=
        "<tr><td>" +
        (item[1] === "yn" ? "Tap water" : item[0]) +
        "</td>";

      sorted.forEach(function (entry) {
        var value = entry.ratings
          ? entry.ratings[groupIndex + "-" + itemIndex]
          : undefined;
        table +=
          "<td>" +
          (value === undefined
            ? "-"
            : item[1] === "yn"
              ? value
                ? "Yes"
                : "No"
              : value) +
          "</td>";
      });

      table += "</tr>";
    });
  });

  $("cmp").innerHTML = table + "</table>";
}

async function removeTasting(id) {
  try {
    await requestJSON("/api/tastings/" + id, { method: "DELETE" });
    saved = saved.filter(function (entry) {
      return entry.id !== id;
    });
    render();
    setStatus("", false);
  } catch (error) {
    setStatus("Could not remove the tasting: " + error.message, true);
  }
}

// Save a tasting through the API so the database remains the source of truth.
$("save").onclick = async function () {
  var saveButton = $("save");
  saveButton.disabled = true;

  try {
    var entry = await requestJSON("/api/tastings", {
      method: "POST",
      body: JSON.stringify({
        cafe: $("cafe").value.trim(),
        date: $("date").value,
        double_price: $("doublePrice").value,
        single_price: $("singlePrice").value,
        note: $("note").value.trim(),
        ratings: vals
      })
    });

    saved.push(entry);
    render();
    vals = {};
    ["cafe", "doublePrice", "singlePrice", "note"].forEach(function (id) {
      $(id).value = "";
    });
    refresh();
    setStatus("", false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    setStatus("Could not save the tasting: " + error.message, true);
  } finally {
    saveButton.disabled = false;
  }
};

async function initialize() {
  try {
    await migrateLegacyEntries();
    saved = await requestJSON("/api/tastings");
    render();
    setStatus("", false);
  } catch (error) {
    saved = [];
    render();
    setStatus(
      "Could not connect to the database. Start the app with python app.py. " +
        error.message,
      true
    );
  }
}

$("date").value = new Date().toISOString().slice(0, 10);
build();
refresh();
initialize();
