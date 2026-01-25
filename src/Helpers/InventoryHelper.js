const getUserId=async (be)=>{
	try {
		const response = await be.fetch('api/users/search?login='+be.login);
		
		if (!response.ok) {
			console.error('Inventory request failed:', response.status, response.statusText);
			return false;
		}
		
		const data = await response.json();
		if (data?.id) {
			be.setUserId(Number(data.id));
			return true;
		}
		return false;
	} catch (error) {
		console.error('Inventory getUserId error:', error);
		return false;
	}
}


export const inventoryAuthScheme={
	authorize: getUserId,
	authCheck: getUserId,
	reqOptions: (options,be) => {
		//options.credentials='include';
		if (!options.headers) options.headers={};
		options.headers['Authorization']='Basic ' + btoa(`${be.login}:${be.password}`);
		return options;
	},
	
}