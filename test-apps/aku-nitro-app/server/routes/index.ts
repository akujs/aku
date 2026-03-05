import { eventHandler } from 'h3';

// Learn more: https://nitro.build/guide/routing
export default eventHandler((event) => {
	const sum = useSum(1, 2);
	return `
      <meta charset="utf-8">
      <h1>This is your brand new Nitro project 🚀 TOTAL SUM ${sum}</h1>
      <p>Get started by editing the <code>server/routes/index.ts</code> file.</p>
      <p>Learn more from 📖 <a href="https://nitro.build/guide" target="_blank">Nitro Documentation</a></p>
    `;
});
