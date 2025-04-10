
export const bxAuthScheme={
	authorize: async (be)=>{
		const response = await fetch(be.baseUrl+'user/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ user:be.login, password:be.password })
		});
		const data = await response.json();
		if (!data.auth??false) return false;
		if (data.hash) {
			be.token = data.hash;
			return true;
		}
		return false;
	},

	authCheck: async (be)=>{
		const response = await be.fetch('user/get');
		const data = await response.json();
		if (data.id) {
			be.setUserId(Number(data.id));
			return true;
		}
		return false;
	},

	reqOptions: (options,be) => {
		//options.credentials='include';
		if (!options.headers) options.headers={};
		options.headers['Authorization']='Basic ' + btoa(`${be.login}:${be.password}`);
		return options;
	},
	checkUrl: (baseUrl) => baseUrl+'user/get',
}