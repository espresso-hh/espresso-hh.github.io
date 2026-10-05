var saved = [];

function $(id) {
  return document.getElementById(id);
}

function groupsFor(category) {
  return category === "home"
    ? window.ESPRESSO_ATHOME_GROUPS
    : window.ESPRESSO_GROUPS;
}

function setStatus(message, isError) {
  var status = $("status");
  status.textContent = message;
  status.classList.toggle("error", Boolean(isError));
}

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

function gavg(ratings, groups, groupIndex) {
  var group = groups[groupIndex];
  var total = 0;
  var count = 0;

  group.items.forEach(function (_item, itemIndex) {
    var value = ratings[groupIndex + "-" + itemIndex];
    if (value !== undefined) {
      total += value;
      count++;
    }
  });

  return count ? total / count : null;
}

function scoreFor(ratings, groups) {
  return groups.reduce(function (total, _group, groupIndex) {
    var average = gavg(ratings, groups, groupIndex);
    return total + (average === null ? 0 : average);
  }, 0);
}

function f1(value) {
  return value === null ? "-" : (Math.round(value * 10) / 10).toFixed(1);
}

function report(entry) {
  var ratings = entry.ratings || {};
  var groups = groupsFor(entry.category);
  var html = '<div class="rep">';

  if (entry.image_url) {
    html +=
      '<img class="review-image" src="' +
      esc(entry.image_url) +
      '" alt="Photo from ' +
      esc(entry.cafe || "this café") +
      '" loading="lazy">';
  }

  if (entry.category === "home") {
    var coffeeDetails = [
      ["Roasting date", entry.roasting_date],
      [
        "Price per 250g",
        entry.price_per_250g !== undefined &&
        entry.price_per_250g !== null &&
        entry.price_per_250g !== ""
          ? "€" + Number(entry.price_per_250g).toFixed(2)
          : ""
      ],
      ["Recipe", entry.recipe]
    ].filter(function (detail) {
      return detail[1] !== undefined && detail[1] !== null && detail[1] !== "";
    });

    if (coffeeDetails.length) {
      html += '<div class="gh"><span>Coffee details</span></div>';
      coffeeDetails.forEach(function (detail) {
        html +=
          '<div class="ln"><span>' +
          esc(detail[0]) +
          '</span><b style="text-align:right;max-width:65%">' +
          esc(detail[1]) +
          "</b></div>";
      });
    }
  }

  groups.forEach(function (group, groupIndex) {
    var average = gavg(ratings, groups, groupIndex);
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
      '<div class="gh"><span>Tasting notes</span></div><div class="ln" style="display:block">' +
      esc(entry.note) +
      "</div>";
  }

  return html + "</div>";
}

function renderReviews(entries, listId, emptyText) {
  var list = $(listId);
  if (!entries.length) {
    list.innerHTML = '<div class="empty">' + emptyText + "</div>";
    return;
  }

  var sorted = entries.slice().sort(function (a, b) {
    var groups = groupsFor(a.category);
    return (
      scoreFor(b.ratings || {}, groupsFor(b.category)) -
      scoreFor(a.ratings || {}, groups)
    );
  });
  list.innerHTML = "";

  sorted.forEach(function (entry) {
    var details = document.createElement("details");
    details.className = "entry";

    var metadata =
      entry.category === "home"
        ? [
            entry.roasting_date ? "Roasted " + entry.roasting_date : "",
            entry.price_per_250g !== undefined &&
            entry.price_per_250g !== null &&
            entry.price_per_250g !== ""
              ? "€" + Number(entry.price_per_250g).toFixed(2) + " / 250g"
              : ""
          ]
        : [
            entry.date,
            entry.double_price !== "" && entry.double_price !== null
              ? "Double " + entry.double_price + " €"
              : "",
            entry.single_price !== "" && entry.single_price !== null
              ? "Single " + entry.single_price + " €"
              : ""
          ];
    metadata = metadata
      .filter(Boolean)
      .join(", ");

    details.innerHTML =
      '<summary><div class="sc">' +
      f1(scoreFor(entry.ratings || {}, groupsFor(entry.category))) +
      "/15" +
      '</div><div class="m"><div>' +
      esc(entry.cafe || "Unnamed café") +
      "</div><div>" +
      esc(metadata) +
      "</div></div></summary>" +
      report(entry);
    list.appendChild(details);
  });
}

function renderComparison(entries, comparisonId) {
  var comparison = $(comparisonId);
  if (entries.length < 2) {
    comparison.innerHTML =
      '<div class="empty">Add two or more reviews in this category to compare them.</div>';
    return;
  }

  var sorted = entries.slice().sort(function (a, b) {
    var groups = groupsFor(a.category);
    return (
      scoreFor(b.ratings || {}, groupsFor(b.category)) -
      scoreFor(a.ratings || {}, groups)
    );
  });
  var groups = groupsFor(sorted[0].category);
  var table = "<table><tr><th></th>";
  sorted.forEach(function (entry) {
    table += "<th>" + esc(entry.cafe || "Unnamed") + "</th>";
  });
  table += '</tr><tr class="g"><td>Total (sum of group averages / 15)</td>';
  sorted.forEach(function (entry) {
    table +=
      "<td>" + f1(scoreFor(entry.ratings || {}, groups)) + " / 15</td>";
  });
  table += "</tr>";

  groups.forEach(function (group, groupIndex) {
    table += '<tr class="g"><td>' + esc(group.t) + " (avg of 5)</td>";
    sorted.forEach(function (entry) {
      table +=
        "<td>" + f1(gavg(entry.ratings || {}, groups, groupIndex)) + "</td>";
    });
    table += "</tr>";

    group.items.forEach(function (item, itemIndex) {
      table +=
        "<tr><td>" +
        esc(item[1] === "yn" ? "Tap water" : item[0]) +
        "</td>";
      sorted.forEach(function (entry) {
        var value = (entry.ratings || {})[groupIndex + "-" + itemIndex];
        table +=
          "<td>" +
          (value === undefined
            ? "-"
            : item[1] === "yn"
              ? value
                ? "Yes"
                : "No"
              : esc(value)) +
          "</td>";
      });
      table += "</tr>";
    });
  });
  comparison.innerHTML = table + "</table>";
}

function render() {
  var homeReviews = saved.filter(function (entry) {
    return entry.category === "home";
  });
  var cafeReviews = saved.filter(function (entry) {
    return entry.category !== "home";
  });

  renderReviews(homeReviews, "homeList", "No at-home reviews have been published yet.");
  renderReviews(cafeReviews, "cafeList", "No café reviews have been published yet.");
  renderComparison(homeReviews, "homeComparison");
  renderComparison(cafeReviews, "cafeComparison");
}

async function initialize() {
  try {
    var response = await fetch("reviews.json");
    if (!response.ok) {
      throw new Error("Could not load reviews.json (HTTP " + response.status + ").");
    }
    var entries = await response.json();
    if (!Array.isArray(entries)) {
      throw new Error("reviews.json must contain a JSON array.");
    }
    saved = entries;
    render();
    setStatus("", false);
  } catch (error) {
    saved = [];
    render();
    setStatus("Could not load the review file. " + error.message, true);
  }
}

initialize();
