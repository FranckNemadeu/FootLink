function DashboardBottomNav({ items }) {
  const scrollToSection = (sectionId) => {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <nav className="dashboard-bottom-nav" aria-label="Navigation dashboard mobile">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => scrollToSection(item.target)}
        >
          <span aria-hidden="true">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </nav>
  );
}

export default DashboardBottomNav;
