// Embed the Deal Marketing app in an iframe inside the portal shell.
// Same-origin iframe (both served from dealmaker-portal.onrender.com) so
// signInWithPopup works fine — no Chrome PNA issue on a public domain.
export default function DealMarketingApp() {
  return (
    <iframe
      src="/pacq-app"
      title="Deal Marketing"
      style={{
        flex: 1,
        border: 'none',
        width: '100%',
        height: '100%',
        display: 'block',
      }}
    />
  );
}
