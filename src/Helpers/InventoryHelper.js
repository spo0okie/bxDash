const getUserId=async (be)=>{
	const response = await be.fetch('api/users/search?login='+be.login);
	const data = await response.json();
	if (data.id) {
		be.setUserId(Number(data.id));
		return true;
	}
	return false;
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