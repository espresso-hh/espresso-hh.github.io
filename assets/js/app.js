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

function reviewDateValue(entry) {
  return dateValue(entry.category === "home" ? entry.roasting_date : entry.date);
}

function comparisonName(entry) {
  var name = entry.cafe || "Unbenannt";
  return entry.category === "home" ? name.trim().split(/\s+/)[0] : name;
}

function dateValue(value) {
  if (typeof value !== "string") {
    return null;
  }

  var match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  var year;
  var month;
  var day;
  if (match) {
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  } else {
    match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!match) {
      return null;
    }
    day = Number(match[1]);
    month = Number(match[2]);
    year = Number(match[3]);
  }

  var timestamp = Date.UTC(year, month - 1, day);
  var parsed = new Date(timestamp);
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
    ? timestamp
    : null;
}

function formatDate(value) {
  var timestamp = dateValue(value);
  if (timestamp === null) {
    return value;
  }

  var date = new Date(timestamp);
  return [
    String(date.getUTCDate()).padStart(2, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    date.getUTCFullYear()
  ].join(".");
}

function newestFirst(entries) {
  return entries.slice().sort(function (a, b) {
    var dateA = reviewDateValue(a);
    var dateB = reviewDateValue(b);
    if (dateA === null || dateB === null) {
      return dateA === dateB ? 0 : dateA === null ? 1 : -1;
    }
    return dateB - dateA;
  });
}

function f1(value) {
  return value === null ? "-" : (Math.round(value * 10) / 10).toFixed(1);
}

function formatEuro(value) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR"
  }).format(Number(value));
}

function report(entry) {
  var ratings = entry.ratings || {};
  var groups = groupsFor(entry.category);
  var html = '<div class="rep">';

  if (entry.image_url) {
    html +=
      '<img class="review-image" src="' +
      esc(entry.image_url) +
      '" alt="Foto von ' +
      esc(entry.cafe || "diesem Café") +
      '" loading="lazy">';
  }

  if (entry.category === "home") {
    var coffeeDetails = [
      ["Röstdatum", entry.roasting_date],
      [
        "Preis pro 250 g",
        entry.price_per_250g !== undefined &&
        entry.price_per_250g !== null &&
        entry.price_per_250g !== ""
          ? formatEuro(entry.price_per_250g)
          : ""
      ],
      [
        "SCA-Bewertung",
        typeof entry.sca_rating === "number" && Number.isFinite(entry.sca_rating)
          ? entry.sca_rating
          : entry.sca_rating === "No SCA rating"
            ? "Keine SCA-Bewertung"
            : ""
      ],
      ["Rezept", entry.recipe]
    ].filter(function (detail) {
      return detail[1] !== undefined && detail[1] !== null && detail[1] !== "";
    });

    if (coffeeDetails.length) {
      html += '<div class="gh"><span>Kaffeedetails</span></div>';
      coffeeDetails.forEach(function (detail) {
        html +=
          '<div class="ln coffee-detail"><span>' +
          esc(detail[0]) +
          '</span><b>' +
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
      var label = item[1] === "yn" ? "Leitungswasser" : item[0];
      var text =
        value === undefined
          ? "-"
          : item[1] === "yn"
            ? value
              ? "Ja"
              : "Nein"
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
      '<div class="gh"><span>Notizen</span></div><div class="ln" style="display:block">' +
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

  list.innerHTML = "";

  entries.forEach(function (entry) {
    var details = document.createElement("details");
    details.className = "entry entry-" + entry.category;
    var score = scoreFor(entry.ratings || {}, groupsFor(entry.category));

    var coffeeName = entry.cafe || "Unbenannt";
    var roaster = "";
    if (entry.category === "home") {
      var separator = coffeeName.indexOf(" - ");
      if (separator !== -1) {
        roaster = coffeeName.slice(separator + 3);
        coffeeName = coffeeName.slice(0, separator);
      }
    }

    var metadata =
      entry.category === "home"
        ? [
            entry.roasting_date
              ? "Geröstet am " + formatDate(entry.roasting_date)
              : "",
            entry.price_per_250g !== undefined &&
            entry.price_per_250g !== null &&
            entry.price_per_250g !== ""
              ? formatEuro(entry.price_per_250g) + " / 250 g"
              : ""
          ]
        : [
            entry.date ? formatDate(entry.date) : "",
            entry.double_price !== "" && entry.double_price !== null
              ? "Doppio " + formatEuro(entry.double_price)
              : "",
            entry.single_price !== "" && entry.single_price !== null
              ? "Single " + formatEuro(entry.single_price)
              : ""
          ];
    metadata = metadata.filter(Boolean);

    var image = entry.image_url
      ? '<img class="entry-thumb" src="' +
        esc(entry.image_url) +
        '" alt="" loading="lazy">'
      : "";
    var roasterMarkup = roaster
      ? '<div class="entry-roaster">' + esc(roaster) + "</div>"
      : "";

    details.innerHTML =
      "<summary>" +
      image +
      '<div class="entry-copy"><div class="entry-heading"><div class="entry-title">' +
      '<div class="entry-name">' +
      esc(coffeeName) +
      "</div>" +
      roasterMarkup +
      '</div><span class="entry-score">' +
      f1(score) +
      '<span class="entry-score-total"> / 15</span></span></div><div class="entry-meta">' +
      metadata
        .map(function (item) {
          return '<span class="entry-meta-item">' + esc(item) + "</span>";
        })
        .join("") +
      "</div></div></summary>" +
      report(entry);

    list.appendChild(details);
  });
}

function renderComparison(entries, comparisonId) {
  var comparison = $(comparisonId);
  if (entries.length < 2) {
    comparison.innerHTML =
      '<div class="empty">Wähle oben zwei oder drei Bewertungen aus und klicke dann auf „Auswahl vergleichen“.</div>';
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
    table += "<th>" + esc(comparisonName(entry)) + "</th>";
  });
  table += '</tr><tr class="g"><td>Gesamt</td>';
  sorted.forEach(function (entry) {
    table +=
      "<td>" + f1(scoreFor(entry.ratings || {}, groups)) + " / 15</td>";
  });
  table += "</tr>";

  groups.forEach(function (group, groupIndex) {
    table += '<tr class="g"><td>' + esc(group.t) + "</td>";
    sorted.forEach(function (entry) {
      table +=
        "<td>" + f1(gavg(entry.ratings || {}, groups, groupIndex)) + "</td>";
    });
    table += "</tr>";

    group.items.forEach(function (item, itemIndex) {
      table +=
        "<tr><td>" +
        esc(item[1] === "yn" ? "Leitungswasser" : item[0]) +
        "</td>";
      sorted.forEach(function (entry) {
        var value = (entry.ratings || {})[groupIndex + "-" + itemIndex];
        table +=
          "<td>" +
          (value === undefined
            ? "-"
            : item[1] === "yn"
              ? value
                ? "Ja"
                : "Nein"
              : esc(value)) +
          "</td>";
      });
      table += "</tr>";
    });
  });
  comparison.innerHTML = table + "</table>";
}

function setupComparisonPicker(entries, category) {
  var prefix = category === "home" ? "home" : "cafe";
  var options = $(prefix + "CompareOptions");
  var count = $(prefix + "CompareCount");
  var button = $(prefix + "CompareButton");
  var comparisonId = prefix + "Comparison";
  var comparison = $(comparisonId);

  options.innerHTML = "";
  entries.forEach(function (entry) {
    var index = saved.indexOf(entry);
    var label = document.createElement("label");
    label.className = "compare-option";

    var checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = String(index);

    var name = document.createElement("span");
    name.className = "compare-name";
    name.textContent = entry.cafe || (category === "home" ? "Unbenannter Kaffee" : "Unbenanntes Café");

    var details = document.createElement("span");
    details.className = "compare-detail";
    details.textContent =
      f1(scoreFor(entry.ratings || {}, groupsFor(entry.category))) + " / 15";

    label.appendChild(checkbox);
    label.appendChild(name);
    label.appendChild(details);
    options.appendChild(label);
  });

  function updateSelection(event) {
    var selected = options.querySelectorAll('input[type="checkbox"]:checked');
    if (selected.length > 3 && event && event.target.checked) {
      event.target.checked = false;
      selected = options.querySelectorAll('input[type="checkbox"]:checked');
    }
    count.textContent = selected.length + " ausgewählt";
    button.disabled = selected.length < 2;
    comparison.innerHTML =
      '<div class="empty">Wähle oben zwei oder drei Bewertungen aus und klicke dann auf „Auswahl vergleichen“.</div>';
  }

  options.addEventListener("change", updateSelection);
  button.addEventListener("click", function () {
    var selectedEntries = Array.prototype.map.call(
      options.querySelectorAll('input[type="checkbox"]:checked'),
      function (checkbox) {
        return saved[Number(checkbox.value)];
      }
    );
    renderComparison(selectedEntries, comparisonId);
  });

  renderComparison([], comparisonId);
  updateSelection();
}

function render() {
  var homeReviews = newestFirst(saved.filter(function (entry) {
    return entry.category === "home";
  }));
  var cafeReviews = newestFirst(saved.filter(function (entry) {
    return entry.category !== "home";
  }));

  renderReviews(homeReviews, "homeList", "Es wurden noch keine Bewertungen für Kaffee zu Hause veröffentlicht.");
  renderReviews(cafeReviews, "cafeList", "Es wurden noch keine Café-Bewertungen veröffentlicht.");
  setupComparisonPicker(homeReviews, "home");
  setupComparisonPicker(cafeReviews, "cafe");
}

async function initialize() {
  try {
    var response = await fetch("reviews.json");
    if (!response.ok) {
      throw new Error("reviews.json konnte nicht geladen werden (HTTP " + response.status + ").");
    }
    var entries = await response.json();
    if (!Array.isArray(entries)) {
      throw new Error("reviews.json muss ein JSON-Array enthalten.");
    }
    saved = entries;
    render();
    setStatus("", false);
  } catch (error) {
    saved = [];
    render();
    setStatus("Die Bewertungsdatei konnte nicht geladen werden. " + error.message, true);
  }
}

initialize();
