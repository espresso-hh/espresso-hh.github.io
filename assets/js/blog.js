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
  var image = post.image
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
  } catch (error) {
    status.classList.add("error");
    status.textContent = "Could not load blog posts. " + error.message;
  }
}

loadBlogPosts();
