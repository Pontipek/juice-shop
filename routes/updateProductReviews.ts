import challengeUtils = require('../lib/challengeUtils');
import { type Request, type Response, type NextFunction } from 'express';
import * as db from '../data/mongodb';
import { challenges } from '../data/datacache';
const security = require('../lib/insecurity');

module.exports = function productReviews () {
  return (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1]; // Extract token from Authorization header

    // Check if token is provided
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Decode and verify the JWT token
    const decoded = jwt.verify(token, 'your-secret-key'); // Use your secret key here to verify the JWT
    const user = security.authenticatedUsers.get(token); // Retrieve the authenticated user

    // Check if user exists and the email matches the one in the decoded token
    if (!user || user.data.email !== decoded.email) {
      return res.status(403).json({ error: 'Forbidden' }); // Unauthorized to update review
    }

    // Get the review ID and message from the request body
    const reviewId = req.body.id;
    const reviewMessage = req.body.message;

    // Define a type for the review if not already defined
    interface Review {
      _id: string;
      author: string;
      message: string;
    }

    // Find the review in the database
    db.reviewsCollection.findOne({ _id: reviewId })
      .then((review: Review | null) => {
        // Check if review exists and if the author's email matches the user
        if (!review || typeof review.author !== 'string' || review.author !== user.data.email) {
          console.log('Author mismatch or review not found'); // Debugging line
          return res.status(403).json({ error: 'Forbidden' }); // Forbidden if authors do not match or review doesn't exist
        }

        // Check if the user's email matches the author's email before updating the message
        if (review.author !== user.data.email) {
          return res.status(403).json({ error: 'Forbidden: Author mismatch' }); // Prevent update if emails don't match
        }

        // If the review is valid, proceed to update it
        return db.reviewsCollection.update(
          { _id: reviewId, author: user.data.email }, // Ensure only the correct author can update
          { $set: { message: reviewMessage, author: user.data.email } }, // Update message, not author
          { multi: false } // Prevent updating multiple documents
        ).then((result: { modified: number, original: Array<{ author: string }> }) => {
          if (!result.original || result.original.length === 0) {
            return res.status(500).json({ error: 'Failed to retrieve the original review' });
          }

          res.json(result); // Send response after update
        });
      })
      .catch((err: Error) => {
        console.error('Error fetching review:', err);
        res.status(500).json({ error: 'Failed to fetch review' });
      });
  };
}