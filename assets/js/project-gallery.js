import { projects } from "./projects.js";

const section = document.querySelector("#projects");
const gallery = document.querySelector("#project-gallery");
let activeProjectId = projects[0]?.id;

function scrollPerProject() {
    return window.innerHeight * 0.6;
}

function getTrack() {
    return gallery.querySelector(".project-gallery-track");
}

function updateSectionHeight() {
    section.style.height = `${window.innerHeight + scrollPerProject() * projects.length}px`;
}

function projectIndexFromScroll() {
    const progress = window.scrollY - section.offsetTop;
    const index = Math.floor(progress / scrollPerProject());
    return Math.min(Math.max(index, 0), projects.length - 1);
}

function scrollTrackToPanel(panel, behavior = "smooth") {
    const track = getTrack();
    const panelLeft = panel.getBoundingClientRect().left - track.getBoundingClientRect().left + track.scrollLeft;
    const panelRight = panelLeft + panel.offsetWidth;
    let target = track.scrollLeft;

    if (panelLeft < track.scrollLeft) {
        target = panelLeft;
    } else if (panelRight > track.scrollLeft + track.clientWidth) {
        target = panelRight - track.clientWidth;
    }

    track.scrollTo({ left: target, behavior });
}

function scrollPageToProject(projectId) {
    const index = projects.findIndex((project) => project.id === projectId);
    window.scrollTo({ top: section.offsetTop + scrollPerProject() * index + 1, behavior: "smooth" });
}

function linkMarkup(url, className, label) {
    if (!url) {
        return "";
    }

    return `<a href="${url}" class="${className}" target="_blank" rel="noopener noreferrer">${label}</a>`;
}

function projectMarkup(project) {
    const isFeatured = project.id === activeProjectId;
    const destinationLink = linkMarkup(project.destinationUrl, "btn btn-sm btn-light", "View Project");
    const sourceLink = linkMarkup(project.sourceUrl, "btn btn-sm btn-outline-light", "Source Code");

    return `<article class="project-panel${isFeatured ? " project-panel-featured" : ""}" data-project-id="${project.id}" tabindex="${isFeatured ? "-1" : "0"}" role="button" aria-label="View ${project.title}">
        <div class="project-panel-button">
            <img src="${project.imageUrl}" alt="${project.title} project preview" class="project-image">
            <span class="project-panel-overlay"></span>
            <span class="project-panel-content">
                <span class="project-panel-title">${project.title}</span>
                <span class="project-panel-description">${project.description}</span>
                <span class="project-panel-actions">${destinationLink}${sourceLink}</span>
            </span>
        </div>
    </article>`;
}

function renderProjects() {
    if (!gallery) {
        return;
    }

    gallery.innerHTML = `<div class="project-gallery-track">${projects.map(projectMarkup).join("")}</div>`;
}

function selectProject(panel) {
    if (!panel || panel.dataset.projectId === activeProjectId) {
        return;
    }

    activeProjectId = panel.dataset.projectId;
    gallery.querySelectorAll(".project-panel").forEach((projectPanel) => {
        const isActive = projectPanel === panel;
        projectPanel.classList.toggle("project-panel-featured", isActive);
        projectPanel.tabIndex = isActive ? -1 : 0;
    });

    panel.addEventListener("transitionend", () => {
        if (panel.dataset.projectId === activeProjectId) {
            scrollTrackToPanel(panel);
        }
    }, { once: true });
}

function handlePageScroll() {
    const project = projects[projectIndexFromScroll()];
    selectProject(gallery.querySelector(`[data-project-id="${project.id}"]`));
}

function handleResize() {
    updateSectionHeight();
    const activePanel = gallery.querySelector(".project-panel-featured");
    if (activePanel) {
        scrollTrackToPanel(activePanel, "instant");
    }
}

function handleGalleryClick(event) {
    const panel = event.target.closest(".project-panel");
    if (panel && panel.dataset.projectId !== activeProjectId) {
        scrollPageToProject(panel.dataset.projectId);
    }
}

function handleGalleryKeydown(event) {
    if ((event.key === "Enter" || event.key === " ") && event.target.matches(".project-panel")) {
        event.preventDefault();
        scrollPageToProject(event.target.dataset.projectId);
    }
}

if (gallery && projects.length > 0) {
    gallery.addEventListener("click", handleGalleryClick);
    gallery.addEventListener("keydown", handleGalleryKeydown);
    renderProjects();
    updateSectionHeight();
    handlePageScroll();
    window.addEventListener("scroll", handlePageScroll, { passive: true });
    window.addEventListener("resize", handleResize);
}
