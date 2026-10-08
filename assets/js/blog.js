function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, function (character) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;"
    }[character];
  });
}

function formatDate(value) {
  var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))));
}

function renderPost(post) {
  var paragraphs = Array.isArray(post.paragraphs) ? post.paragraphs : [];
  var images = Array.isArray(post.images)
    ? post.images.filter(function (image) {
        return image && typeof image.src === "string" && image.src;
      })
    : [];
  var image = images.length
    ? '<div class="blog-carousel">' +
      '<div class="blog-gallery" tabindex="0" role="region" aria-label="Photo gallery for ' +
      escapeHtml(post.heading) +
      '"><div class="blog-gallery-track">' +
      images
        .map(function (item) {
          return (
            '<div class="blog-gallery-slide"><img class="blog-gallery-image" src="' +
            escapeHtml(item.src) +
            '" alt="' +
            escapeHtml(item.alt || post.heading) +
            '" loading="lazy"></div>'
          );
        })
        .join("") +
      '</div></div><div class="blog-gallery-controls">' +
      '<span class="blog-gallery-count" aria-live="polite">1 / ' +
      images.length +
      "</span></div></div>"
    : post.image
    ? '<img class="blog-image" src="' +
      escapeHtml(post.image) +
      '" alt="' +
      escapeHtml(post.image_alt || post.heading) +
      '" loading="lazy">'
    : "";

  return (
    '<article class="info-section blog-post">' +
    image +
    "<h2>" +
    escapeHtml(post.heading) +
    "</h2>" +
    '<p class="blog-subheading">' +
    escapeHtml(post.subheading) +
    "</p>" +
    '<div class="blog-copy">' +
    paragraphs
      .map(function (paragraph) {
        return "<p>" + escapeHtml(paragraph) + "</p>";
      })
      .join("") +
    "</div>" +
    '<footer class="blog-byline"><span>' +
    escapeHtml(post.signature) +
    "</span><time datetime=\"" +
    escapeHtml(post.date) +
    '">' +
    escapeHtml(formatDate(post.date)) +
    "</time></footer>" +
    "</article>"
  );
}

function setupBlogGalleries(container) {
  container.querySelectorAll(".blog-carousel").forEach(function (carousel) {
    var gallery = carousel.querySelector(".blog-gallery");
    var track = carousel.querySelector(".blog-gallery-track");
    var count = carousel.querySelector(".blog-gallery-count");
    var imageCount = track.children.length;

    if (imageCount < 2) {
      return;
    }

    var lastSlide = track.lastElementChild.cloneNode(true);
    var firstSlide = track.firstElementChild.cloneNode(true);
    [lastSlide, firstSlide].forEach(function (slide) {
      slide.setAttribute("aria-hidden", "true");
      slide.querySelector("img").alt = "";
      slide.querySelector("img").loading = "eager";
    });
    track.insertBefore(lastSlide, track.firstElementChild);
    track.appendChild(firstSlide);
    var position = 1;

    function updatePosition() {
      track.style.transform = "translateX(-" + position * 100 + "%)";
      count.textContent = ((position - 1 + imageCount) % imageCount) + 1 +
        " / " + imageCount;
    }

    function move(direction) {
      position += direction;
      updatePosition();
    }

    track.addEventListener("transitionend", function (event) {
      if (event.target !== track) {
        return;
      }
      if (position === 0 || position === imageCount + 1) {
        track.classList.add("no-transition");
        position = position === 0 ? imageCount : 1;
        updatePosition();
        track.offsetHeight;
        track.classList.remove("no-transition");
      }
    });
    var pointerStart;
    gallery.addEventListener("pointerdown", function (event) {
      pointerStart = event.clientX;
    });
    gallery.addEventListener("pointerup", function (event) {
      if (pointerStart === undefined) {
        return;
      }
      var distance = event.clientX - pointerStart;
      pointerStart = undefined;
      if (Math.abs(distance) > 40) {
        move(distance < 0 ? 1 : -1);
      }
    });
    gallery.addEventListener("pointercancel", function () {
      pointerStart = undefined;
    });
    gallery.addEventListener("keydown", function (event) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        move(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        move(1);
      }
    });
    window.addEventListener("resize", updatePosition);
    window.setInterval(function () {
      if (document.hidden) {
        return;
      }
      move(1);
    }, 4000);
    updatePosition();
  });
}

async function loadBlogPosts() {
  var container = document.getElementById("blogPosts");
  var status = document.getElementById("blogStatus");

  try {
    var response = await fetch("blog-posts.json");
    if (!response.ok) {
      throw new Error("Could not load blog-posts.json (HTTP " + response.status + ").");
    }

    var posts = await response.json();
    if (!Array.isArray(posts)) {
      throw new Error("blog-posts.json must contain a JSON array.");
    }

    posts.sort(function (a, b) {
      return String(b.date).localeCompare(String(a.date));
    });

    if (!posts.length) {
      container.innerHTML =
        '<section class="info-section"><h2>No posts yet</h2><p>Add your first post to <code>blog-posts.json</code>.</p></section>';
      return;
    }

    container.innerHTML = posts.map(renderPost).join("");
    setupBlogGalleries(container);
  } catch (error) {
    status.classList.add("error");
    status.textContent = "Could not load blog posts. " + error.message;
  }
}

loadBlogPosts();
