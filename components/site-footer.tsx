import { contact } from "@/src/data/site";
import { FooterSocials } from "./footer-socials";

const marqueeText = "CRAFTING VISUALS THAT CONNECT •";

export function SiteFooter() {
  return (
    <footer id="footer" className="site-footer">
      <div className="footer-frame">
        <div className="footer-marquee" aria-hidden="true">
          <div className="footer-marquee-track">
            {[0, 1].map((copy) => (
              <div key={copy} className="footer-marquee-group">
                <span>{marqueeText}</span>
                <span>{marqueeText}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="footer-columns">
          <div>
            <p className="footer-name">Soumen.</p>
            <p>Video Editor · Motion Designer</p>
          </div>
          <div className="footer-connect">
            <h2 className="editorial-label">Connect</h2>
            <a href={`mailto:${contact.email}`}>{contact.email}</a>
            <p>{contact.location}</p>
            <p className="availability">
              <span aria-hidden="true" />
              Available for projects
            </p>
          </div>
          <div>
            <h2 className="editorial-label">Follow</h2>
            <FooterSocials />
          </div>
        </div>
        <p className="footer-copyright">
          © 2026 Soumen Mandal. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
