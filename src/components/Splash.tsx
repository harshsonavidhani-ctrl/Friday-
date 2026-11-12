/**
 * 3-second opening animation, shown only when the INSTALLED app starts
 * (not on the normal website). Pure CSS — see "Splash" in globals.css.
 * Preview it in any browser with ?splash=1.
 */
export const SPLASH_SCRIPT = `(function(){try{var d=document.documentElement,q=location.search;
if(/[?&]splash=1/.test(q)){d.classList.add('la-splash-force');return}
var mm=function(m){return matchMedia('(display-mode: '+m+')').matches};
// installed app (any mode) — or opened from the home-screen icon, whose link ends in ?source=app
var app=mm('standalone')||mm('fullscreen')||mm('minimal-ui')||navigator.standalone===true||/[?&]source=app/.test(q);
if(!app)return;
if(sessionStorage.getItem('la_splash')){d.classList.add('la-splash-skip')}else{sessionStorage.setItem('la_splash','1');d.classList.add('la-splash-force')}
}catch(e){}})();`;

export function Splash({ name, tagline }: { name: string; tagline: string }) {
  return (
    <div id="la-splash" aria-hidden="true">
      <div className="la-glow la-glow-a" />
      <div className="la-glow la-glow-b" />
      <div className="la-center">
        <div className="la-logo">
          <span className="la-ring" />
          <span className="la-ring la-ring-2" />
          <svg viewBox="0 0 100 100" className="la-mark">
            <rect width="100" height="100" rx="24" fill="#1b2566" />
            <path className="la-l" d="M18 24h12v40h10v12H18z" fill="#fbb424" />
            <path className="la-a" fill="#fff" fillRule="evenodd" d="M56 24h12l16 52H72l-3-10H55l-3 10H40zM62 40l4 16h-8z" />
          </svg>
          <span className="la-shine" />
        </div>
        <p className="la-name">{name}</p>
        <p className="la-tag">{tagline}</p>
      </div>
      <div className="la-bar">
        <span />
      </div>
    </div>
  );
}
