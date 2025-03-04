import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { User } from '../models/user.model.js'
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"


const registerUser = asyncHandler(async (req, res) => {
    //step 1: get user detail from frontend
    //step 2: validation - not empty
    //step 3: check if user already exists: username, email
    //step 4: check for images, check for avatar
    //step 5: upload them to cloudinary, avatar
    //step 6: create user object - create entry in db
    //step 7: remove password and refresh token field from response
    //step 8: check for user creation
    //step 9: return response



    //step 1: get user detail from frontend
    const { fullName, email, username, password } = req.body
    


    //step 2: validation - not empty
    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "fullName is required")
    }


    //step 3: check if user already exists: username, email
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "user with email or username already exists")
    }


    //step 4: check for images, check for avatar
    const avartarLocalPath = req.files?.avatar[0]?.path
    // const coverImageLocalPath = req.files?.coverImage[0]?.path

    let coverImageLocalPath 
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if (!avartarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }


    //step 5: upload them to cloudinary, avatar
    const avatar = await uploadOnCloudinary(avartarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }


    //step 6: create user object - create entry in db
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })
    
    
    
    //step 7: remove password and refresh token field from response
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    //step 8: check for user creation
    if(!createdUser) {
        throw new ApiError(500, "Somthing went wrong while registering the user")

    }


    //step 9: return response
    return res.status(201).json(
        new ApiResponse(200,createdUser, "User registered Successfully")
    )


})


export { registerUser }