import { v2 as cloudinary } from "cloudinary"
import fs from "fs"
import { ApiError } from "./ApiError";


// Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_API_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

//Upload
const uploadOnCloudinary = async (loacalFilePath) => {
    try {
        if (!loacalFilePath) return null

        //upload the file on cloudinary
        const response = await cloudinary.uploader.upload(loacalFilePath,{
            resource_type: "auto"
        })
        
        //file has been uplaoded successfully
        // console.log("file is uploaded on cloudinary");
        console.log(response.url);
        fs.unlinkSync(loacalFilePath) 
        return response    
    } catch (error) {
        fs.unlink(loacalFilePath) //remove the locally saved temporary file as the upload operation got failed

        return null
    }
}

// extract public id
const getPublicIdFromURL = async (url) => {
    const parts = url.split("/")
    const fileName = parts.pop()
    const publicId = fileName.split(".")[0]

    return publicId
}

//delete
const deleteFromCloudinary = async (url) => {
    try {
        if (!url)return null

        const publicId = getPublicIdFromURL(url)

        const result = await cloudinary.uploader.destroy(publicId)

        console.log(`Deleted: ${result}`);

    } catch (error) {
        throw new ApiError(401,error.message)
    }
}


export {uploadOnCloudinary, deleteFromCloudinary}




// cloudinary.v2.uploader.upload(
//     'https://res.cloudinary.com/demo/image/upload/getting-started/shoes.jpg',
//     { public_id: "shoes" },
//     function (error, result) {
//         console.log(result);
//     }
// )
