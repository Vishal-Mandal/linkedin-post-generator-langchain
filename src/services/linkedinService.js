import axios from 'axios';
import fs from 'fs';

/**
 * Gets LinkedIn Profile. Uses mock profile if token is missing or if token is 'mock'.
 * @param {string} token 
 * @returns {Promise<{id: string, urn: string, name: string, avatar: string, isMock: boolean}>}
 */
export async function getProfile(token) {
  if (!token || token === 'mock') {
    return {
      id: 'mock_user_123',
      urn: 'urn:li:person:mock_user_123',
      name: 'Alex Developer (Mock Profile)',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      isMock: true
    };
  }

  // Try standard OpenID Connect (OIDC) userinfo first, which is used by modern apps
  try {
    const response = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = response.data;
    const id = data.sub; // OIDC unique identifier is 'sub'
    const name = data.name || `${data.given_name || ''} ${data.family_name || ''}`.trim() || "LinkedIn Member";
    const avatar = data.picture || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';

    return {
      id,
      urn: `urn:li:person:${id}`,
      name,
      avatar,
      isMock: false
    };
  } catch (oidcError) {
    console.warn("OIDC Userinfo retrieval failed, trying legacy me endpoint:", oidcError.response?.data || oidcError.message);
    
    // Fallback to legacy v2/me endpoint
    try {
      const response = await axios.get('https://api.linkedin.com/v2/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = response.data;
      const id = data.id;
      const firstName = data.localizedFirstName || (data.firstName?.localized && Object.values(data.firstName.localized)[0]) || "LinkedIn";
      const lastName = data.localizedLastName || (data.lastName?.localized && Object.values(data.lastName.localized)[0]) || "Member";

      let avatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';
      try {
        const displayImage = data.profilePicture?.['displayImage~']?.elements;
        if (displayImage && displayImage.length > 0) {
          const identifiers = displayImage[displayImage.length - 1].identifiers;
          if (identifiers && identifiers.length > 0) {
            avatar = identifiers[0].identifier;
          }
        }
      } catch (e) {
        console.warn("Could not parse legacy profile photo:", e.message);
      }

      return {
        id,
        urn: `urn:li:person:${id}`,
        name: `${firstName} ${lastName}`,
        avatar,
        isMock: false
      };
    } catch (legacyError) {
      console.error("Failed to retrieve profile details from OIDC and Legacy APIs:", legacyError.response?.data || legacyError.message);
      throw new Error(`LinkedIn Profile retrieval failed: OIDC: ${oidcError.message}, Legacy: ${legacyError.response?.data?.message || legacyError.message}`);
    }
  }
}

/**
 * Registers and uploads image asset to LinkedIn
 * @param {string} token 
 * @param {string} personUrn 
 * @param {string} filePath 
 * @returns {Promise<string>} Asset URN
 */
export async function uploadImage(token, personUrn, filePath) {
  if (!token || token === 'mock') {
    return 'urn:li:digitalmediaAsset:mock_image_asset_123';
  }

  try {
    // Step 1: Register Upload
    const registerUrl = 'https://api.linkedin.com/v2/assets?action=registerUpload';
    const registerBody = {
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: personUrn,
        supportedUploadMechanism: ['SYNCHRONOUS_UPLOAD'],
        serviceRelationships: [
          {
            relationshipType: 'OWNER',
            identifier: 'urn:li:userGeneratedContent'
          }
        ]
      }
    };

    const registerRes = await axios.post(registerUrl, registerBody, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Type': 'application/json'
      }
    });

    const uploadMechanism = registerRes.data.value.uploadMechanism;
    const uploadUrl = uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
    const assetUrn = registerRes.data.value.asset;

    // Step 2: Read binary and upload using PUT
    const fileData = fs.readFileSync(filePath);
    await axios.put(uploadUrl, fileData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'image/png' // Generic content-type for the upload
      }
    });

    return assetUrn;
  } catch (error) {
    console.error("Failed to upload image to LinkedIn:", error.response?.data || error.message);
    throw new Error(`LinkedIn Image upload failed: ${error.response?.data?.message || error.message}`);
  }
}

/**
 * Publishes a post to LinkedIn
 * @param {object} params
 * @param {string} params.token LinkedIn access token
 * @param {string} params.postText The post content
 * @param {string} [params.imagePath] Local path of the image if posting image
 * @returns {Promise<{success: boolean, isMock: boolean, postId: string, permalink: string}>}
 */
export async function publishPost({ token, postText, imagePath }) {
  const isMock = !token || token === 'mock';

  if (isMock) {
    // Simulate API network latency
    await new Promise(resolve => setTimeout(resolve, 1500));
    const randomId = Math.random().toString(36).substring(2, 11).toUpperCase();
    return {
      success: true,
      isMock: true,
      postId: `urn:li:share:mock_${randomId}`,
      permalink: `https://www.linkedin.com/feed/update/urn:li:activity:mock_${randomId}`
    };
  }

  try {
    const profile = await getProfile(token);
    let assetUrn = null;

    if (imagePath) {
      assetUrn = await uploadImage(token, profile.urn, imagePath);
    }

    const ugcPostUrl = 'https://api.linkedin.com/v2/ugcPosts';
    
    // Construct the UGC Post body
    const postBody = {
      author: profile.urn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: postText
          },
          shareMediaCategory: assetUrn ? 'IMAGE' : 'NONE'
        }
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
      }
    };

    if (assetUrn) {
      postBody.specificContent['com.linkedin.ugc.ShareContent'].media = [
        {
          status: 'READY',
          description: {
            text: 'Visual attachment generated by LinkedIn Post Manager'
          },
          media: assetUrn,
          title: {
            text: 'Post Graphic'
          }
        }
      ];
    }

    const response = await axios.post(ugcPostUrl, postBody, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Type': 'application/json'
      }
    });

    const postId = response.headers['x-restli-id'] || response.data.id;
    return {
      success: true,
      isMock: false,
      postId: postId,
      permalink: `https://www.linkedin.com/feed/update/${postId}`
    };
  } catch (error) {
    console.error("Failed to publish post to LinkedIn:", error.response?.data || error.message);
    throw new Error(`LinkedIn publishing failed: ${error.response?.data?.message || error.message}`);
  }
}
