import { Link } from "react-router-dom";
import footlinkLogo from "../assets/footlink-logo.png";

function BrandLogo() {
  return (
    <Link className="brand-link" to="/" aria-label="FootLink accueil">
      <img className="brand-logo-image" src={footlinkLogo} alt="FootLink" />
    </Link>
  );
}

export default BrandLogo;
