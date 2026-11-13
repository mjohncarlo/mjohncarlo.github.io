import { projects } from "./projects.js";

const gallery = document.querySelector("#project-gallery");
let activeProjectId = projects[0]?.id;

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
        panel.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }, { once: true });
}

function handleGalleryClick(event) {
    selectProject(event.target.closest(".project-panel"));
}

function handleGalleryKeydown(event) {
    if ((event.key === "Enter" || event.key === " ") && event.target.matches(".project-panel")) {
        event.preventDefault();
        selectProject(event.target);
    }
}

if (gallery && projects.length > 0) {
    gallery.addEventListener("click", handleGalleryClick);
    gallery.addEventListener("keydown", handleGalleryKeydown);
    renderProjects();
}
