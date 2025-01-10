import axios from 'axios';

class Inventory {
    baseUrl=null;
    user=null;
    password=null;
    isAuthorized=false;


    authorize(user,password,successHandler=()=>{},failHandler=()=>{}) {
        this.user=user;
        this.password=password;
        this.get('users','search',{'login':user},(data)=>{
            if (data.Login && data.Login==this.user) {
                successHandler();
            } else {
                console.log('Inventory Auth error: user not found');
                failHandler();
            }
    
        },failHandler);
    }

    get(controller,method,params,successHandler,failHandler=()=>{}) {
        axios.get(this.baseUrl+'/'+controller+'/'+method,{
            params: params,
            /*headers: {
                "Content-Type": "application/json",
                'Access-Control-Allow-Origin': '*',
            },*/
            auth: {
                username: this.user,
                password: this.password
            }
        })
        .then((response) => {
            successHandler(response.data);
        })
        .catch(error => {
            console.error(error);
            failHandler();
        });
    }

}

export default Inventory;