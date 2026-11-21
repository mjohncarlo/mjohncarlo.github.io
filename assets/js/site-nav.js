const nav = document.querySelector(".site-nav");
const hero = document.querySelector("#hero");

function setNavVisible(isVisible) {
    nav.classList.toggle("site-nav-visible", isVisible);
}

if (nav) {
    if (hero && "IntersectionObserver" in window) {
        const observer = new IntersectionObserver(([entry]) => {
            setNavVisible(!entry.isIntersecting);
        });

        observer.observe(hero);
    } else {
        setNavVisible(true);
    }
}
